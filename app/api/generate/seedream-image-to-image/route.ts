import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { deductCredits } from '@/lib/credits';
import { trackStorageUpload } from '@/lib/storageEvents';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';

// Vercel function configuration - extend timeout for image generation
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max (Pro plan)
export const dynamic = 'force-dynamic';

const BYTEPLUSES_API_KEY = process.env.ARK_API_KEY!;
const BYTEPLUSES_API_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";

/**
 * Dynamically determine feature key from the request URL path
 * Example: /api/generate/seedream-image-to-image -> seedream_image_to_image
 */
function getFeatureKeyFromPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];

  // Convert kebab-case to snake_case
  // seedream-image-to-image -> seedream_image_to_image
  const featureKey = lastSegment.replace(/-/g, '_');

  return featureKey;
}

// AWS S3 Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      prompt,
      model = "ep-20260103160511-gxx75",
      image, // Can be a single string or array of strings
      watermark = false,
      sequential_image_generation = "disabled",
      sequential_image_generation_options,
      size = "2048x2048",
      pixelDimensions, // Actual pixel dimensions for DB storage (separate from size label sent to API for 5.0 LITE)
      output_format, // Only for seedream-5.0-lite: "jpeg" | "png"
      targetFolder,
      organizationSlug,
      // Vault folder support
      saveToVault,
      vaultProfileId,
      vaultFolderId,
      // Generation parameters for reuse
      resolution,
      aspectRatio,
      referenceImageUrls, // Array of reference image URLs for reuse
    } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    // Get user's organization ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    // Dynamically determine feature key from URL path
    const featureKey = await getFeatureKeyFromPath(request.url);

    if (!featureKey) {
      return NextResponse.json(
        { error: "Feature pricing not configured for this endpoint" },
        { status: 500 }
      );
    }

    // Deduct credits using the dynamically determined feature key
    const creditResult = await deductCredits(
      user.currentOrganizationId,
      featureKey,
      user.id
    );

    if (!creditResult.success) {
      return NextResponse.json(
        {
          error: creditResult.error || 'Failed to deduct credits',
          insufficientCredits: creditResult.error?.includes('Insufficient credits')
        },
        { status: 400 }
      );
    }

    // Resolve image inputs: the client may send S3 URLs instead of base64 to keep
    // the request payload small. Download any URL-based images server-side and
    // convert them to data-URL strings that the BytePlus API expects.
    const resolveImageInput = async (input: string): Promise<string> => {
      // Already a data URL or raw base64 — pass through
      if (input.startsWith('data:') || !input.startsWith('http')) {
        return input;
      }
      // It's a URL — download and convert to data URL
      console.log('📥 Downloading reference image from URL for BytePlus...');
      const imgResponse = await fetch(input);
      if (!imgResponse.ok) {
        throw new Error(`Failed to download reference image: ${imgResponse.statusText}`);
      }
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${contentType};base64,${base64}`;
    };

    let resolvedImage: string | string[];
    if (Array.isArray(image)) {
      resolvedImage = await Promise.all(image.map(resolveImageInput));
      console.log(`Resolved ${resolvedImage.length} images (${resolvedImage.map(i => i.startsWith('data:') ? 'base64' : 'unknown').join(', ')})`);
    } else {
      resolvedImage = await resolveImageInput(image);
    }

    // Prepare BytePlus API request payload
    const payload: any = {
      model,
      prompt,
      image: resolvedImage,
      watermark,
      size,
      response_format: "url", // Required explicitly for batch generation per official docs
    };

    // Add output_format for seedream-5.0-lite
    if (output_format) {
      payload.output_format = output_format;
    }

    // Log image count if array
    if (Array.isArray(resolvedImage)) {
      console.log(`Processing ${resolvedImage.length} images (1 primary + ${resolvedImage.length - 1} reference)`);
    }

    // Add sequential image generation config if batch size > 1
    if (sequential_image_generation && sequential_image_generation !== "disabled") {
      payload.sequential_image_generation = sequential_image_generation;
      
      if (sequential_image_generation_options) {
        payload.sequential_image_generation_options = sequential_image_generation_options;
        console.log("Batch generation enabled:", {
          mode: sequential_image_generation,
          options: sequential_image_generation_options,
        });
      }
    }

    console.log("Sending Image-to-Image request to BytePlus API with payload:", JSON.stringify(payload, null, 2));

    // Call BytePlus API with automatic retry on ServerOverloaded / 429
    const RETRY_DELAYS_MS = [5_000, 10_000, 20_000]; // 5s → 10s → 20s
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let response!: Response;
    let lastErrorData: any = null;
    let lastStatus = 0;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      response = await fetch(BYTEPLUSES_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BYTEPLUSES_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) break; // success — exit retry loop

      const errorText = await response.text();
      try {
        lastErrorData = JSON.parse(errorText);
      } catch {
        lastErrorData = { message: errorText };
      }
      lastStatus = response.status;

      const isOverloaded = response.status === 429 || lastErrorData?.error?.code === 'ServerOverloaded';

      if (!isOverloaded || attempt === RETRY_DELAYS_MS.length) {
        // Non-retriable error, or we've exhausted retries — fall through to error handler
        break;
      }

      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(`BytePlus ServerOverloaded (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}). Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }

    if (!response.ok) {
      console.error("BytePlus API error response:", {
        status: lastStatus,
        error: lastErrorData,
      });

      // Extract error message, handling nested error objects
      let errorMessage = "Image generation failed";
      if (typeof lastErrorData?.message === 'string') {
        errorMessage = lastErrorData.message;
      } else if (typeof lastErrorData?.error === 'string') {
        errorMessage = lastErrorData.error;
      } else if (lastErrorData?.error && typeof lastErrorData.error === 'object') {
        errorMessage = lastErrorData.error.message || lastErrorData.error.code || "Image generation failed";
      }

      // Add user-friendly messages for specific error codes
      if (lastStatus === 429 || lastErrorData?.error?.code === 'ServerOverloaded') {
        errorMessage = "BytePlus servers are currently overloaded. Generation was attempted 4 times but the service is unavailable. Please try again in a few minutes.";
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: lastErrorData,
        },
        { status: lastStatus || 503 }
      );
    }

    const data = await response.json();
    console.log("BytePlus API response:", {
      numImages: data.data?.length || 0,
      hasImages: !!data.data,
    });

    // Create generation job in database
    const generationJob = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: 'COMPLETED',
        type: 'IMAGE_TO_IMAGE',
        progress: 100,
        params: {
          source: 'seedream-i2i',
          prompt: body.prompt,
          model: body.model || 'ep-20260103160511-gxx75',
          size: body.size,
          watermark: body.watermark,
          targetFolder: body.targetFolder,
          organizationSlug: organizationSlug || null,
          numReferenceImages: Array.isArray(image) ? image.length : 1,
          saveToVault: body.saveToVault,
          vaultProfileId: body.vaultProfileId,
          vaultFolderId: body.vaultFolderId,
        },
      },
    });

    console.log('📝 Created generation job:', generationJob.id);

    // Check if saving to vault - verify folder exists and user has access
    let vaultFolder = null;
    if (saveToVault && vaultProfileId && vaultFolderId) {
      // First check if user owns the folder
      vaultFolder = await prisma.vaultFolder.findFirst({
        where: {
          id: vaultFolderId,
          clerkId: userId,
          profileId: vaultProfileId,
        },
      });

      // If not owned, check if folder is shared with user OR if profile is shared via organization
      if (!vaultFolder) {
        // Get the user's internal ID for organization membership checks
        const currentUser = await prisma.user.findUnique({
          where: { clerkId: userId },
          select: {
            id: true,
            currentOrganizationId: true,
          },
        });

        // Get the profile to check organization membership
        const profile = await prisma.instagramProfile.findUnique({
          where: { id: vaultProfileId },
          select: {
            id: true,
            clerkId: true,
            organizationId: true,
          },
        });

        // Check if user has access via organization:
        // 1. Profile belongs to an organization
        // 2. User is a member of that organization (either currentOrganizationId matches OR they're in members list)
        let isOrgMember = false;
        
        if (profile?.organizationId && currentUser) {
          // Check if user's current organization matches profile's organization
          if (currentUser.currentOrganizationId === profile.organizationId) {
            isOrgMember = true;
          } else {
            // Also check if user is directly a member of that organization
            const membership = await prisma.teamMember.findFirst({
              where: {
                userId: currentUser.id, // Use User.id, not clerkId
                organizationId: profile.organizationId,
              },
            });
            isOrgMember = !!membership;
          }
        }

        console.log('🔍 Access check:', {
          userId,
          userInternalId: currentUser?.id,
          profileId: vaultProfileId,
          profileOrgId: profile?.organizationId,
          userCurrentOrgId: currentUser?.currentOrganizationId,
          isOrgMember,
        });

        if (isOrgMember) {
          // User has access to the profile through organization membership
          // Now just verify the folder exists and belongs to this profile
          vaultFolder = await prisma.vaultFolder.findFirst({
            where: {
              id: vaultFolderId,
              profileId: vaultProfileId,
            },
          });

          if (vaultFolder) {
            console.log('� Using organization shared vault folder:', vaultFolder.name);
          }
        } else {
          // Check if folder is explicitly shared via VaultFolderShare
          const sharedFolder = await prisma.vaultFolder.findFirst({
            where: {
              id: vaultFolderId,
              profileId: vaultProfileId,
              shares: {
                some: {
                  sharedWithClerkId: userId,
                },
              },
            },
            include: {
              shares: {
                where: {
                  sharedWithClerkId: userId,
                },
                select: {
                  permission: true,
                },
              },
            },
          });

          // Check if shared folder was found and user has EDIT permission
          if (sharedFolder) {
            const hasEditPermission = sharedFolder.shares.some(
              (share) => share.permission === 'EDIT'
            );
            
            if (hasEditPermission) {
              vaultFolder = sharedFolder;
              console.log('📂 Using explicitly shared vault folder (EDIT access):', vaultFolder.name);
            } else {
              console.error('❌ Vault folder found but user only has VIEW permission');
              return NextResponse.json(
                { error: 'Insufficient permissions. EDIT access required to generate content in this folder.' },
                { status: 403 }
              );
            }
          }
        }
      } else {
        console.log('📂 Using owned vault folder:', vaultFolder.name);
      }

      if (!vaultFolder) {
        console.error('❌ Vault folder not found or access denied');
        return NextResponse.json(
          { error: 'Vault folder not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Process and save each generated image IN PARALLEL (much faster!)
    console.log(`⚡ Processing ${data.data.length} images in parallel...`);
    
    const imageProcessingPromises = data.data.map(async (item: any, index: number) => {
      try {
        // Get image data (either from URL or base64)
        let imageBuffer: Buffer;
        
        if (item.url) {
          // Download from URL
          console.log(`📥 Downloading image ${index + 1} from URL...`);
          const imageResponse = await fetch(item.url);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        } else if (item.b64_json) {
          // Decode base64
          console.log(`📥 Decoding base64 image ${index + 1}...`);
          imageBuffer = Buffer.from(item.b64_json, 'base64');
        } else {
          console.error('❌ No image data found for index:', index);
          return null; // Skip this image
        }

        // Generate filename
        const timestamp = Date.now();
        const fileExtension = output_format === 'jpeg' ? 'jpg' : 'png';
        const contentType = output_format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const filename = `seedream-i2i-${timestamp}-${index}.${fileExtension}`;
        
        // Determine S3 key based on storage type (vault vs regular S3)
        let s3Key: string;
        let subfolder = '';
        let publicUrl: string;
        
        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          // Save to vault storage: vault/{ownerClerkId}/{profileId}/{folderId}/{fileName}
          // Use the folder owner's clerkId (vaultFolder.clerkId), not current user's
          s3Key = organizationSlug
            ? `organizations/${organizationSlug}/vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`
            : `vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`;
          console.log(`📤 Uploading to Vault S3: ${s3Key} (owner: ${vaultFolder.clerkId})`);
        } else if (body.targetFolder) {
          // Use selected folder (already includes outputs/{userId}/ prefix)
          s3Key = `${body.targetFolder.replace(/\/$/, '')}/${filename}`;
          // Extract subfolder name from prefix for database
          const parts = body.targetFolder.split('/');
          if (parts.length > 2) {
            subfolder = parts.slice(2).join('/').replace(/\/$/, '');
          }
        } else {
          // Use default: outputs/{userId}/{filename}
          s3Key = `outputs/${userId}/${filename}`;
        }

        console.log(`📤 Uploading to S3: ${s3Key}`);

        // Upload to AWS S3
        const uploadCommand = new PutObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: s3Key,
          Body: imageBuffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000',
        });

        await s3Client.send(uploadCommand);

        // Generate public URL via CDN
        const s3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
        publicUrl = convertS3ToCdnUrl(s3Url);

        console.log(`✅ Image uploaded: ${publicUrl}`);

        // Save to database - different handling for vault vs regular
        // Use pixelDimensions (always pixel dims) since body.size may be a label like "2K" for 5.0 LITE
        const dbDimStr = (() => {
          const candidates = [item.size, pixelDimensions, body.size, '2048x2048'];
          return candidates.find(s => s && s.includes('x')) || '2048x2048';
        })();
        const [width, height] = dbDimStr.split('x').map(Number);
        
        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          // Save to vault database with generation metadata
          // Use vaultFolder.clerkId (the profile owner's clerkId) so the item appears in the vault
          // This ensures items show up correctly even when generated by a team member on a shared profile
          const vaultItem = await prisma.vaultItem.create({
            data: {
              clerkId: vaultFolder.clerkId, // Use folder owner's clerkId, not current user
              profileId: vaultProfileId,
              folderId: vaultFolderId,
              fileName: filename,
              fileType: contentType,
              fileSize: imageBuffer.length,
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: {
                source: 'seedream-i2i',
                generationType: 'image-to-image',
                model: data.model || model,
                prompt: body.prompt,
                size: item.size || body.size,
                resolution: body.resolution || (body.size?.includes('4096') || body.size?.includes('4704') || body.size?.includes('5504') || body.size?.includes('6240') ? '4K' : '2K'),
                aspectRatio: body.aspectRatio || null,
                watermark: body.watermark,
                numReferenceImages: Array.isArray(image) ? image.length : 1,
                referenceImageUrls: body.referenceImageUrls || [],
                generatedAt: new Date().toISOString(),
                generatedByClerkId: userId, // Track who actually generated it
              },
            },
          });

          console.log(`✅ Saved to vault database: ${vaultItem.id}`);

          // Track storage usage (non-blocking)
          if (imageBuffer.length > 0) {
            trackStorageUpload(vaultFolder.clerkId, imageBuffer.length).catch((error) => {
              console.error('[SeeDream I2I] Failed to track storage upload:', error);
            });
          }

          return {
            id: vaultItem.id,
            url: publicUrl,
            size: item.size || body.size,
            prompt: body.prompt,
            model: data.model,
            createdAt: vaultItem.createdAt.toISOString(),
            savedToVault: true,
          };
        } else {
          // Save to regular generated images database
          const savedImage = await prisma.generatedImage.create({
            data: {
              clerkId: userId,
              jobId: generationJob.id,
              filename,
              subfolder: subfolder,
              type: 'output',
              fileSize: imageBuffer.length,
              width,
              height,
              format: fileExtension === 'jpg' ? 'jpeg' : fileExtension,
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: {
                source: 'seedream-i2i',
                model: data.model,
                prompt: body.prompt,
                size: body.size,
                resolution: body.resolution || (body.size?.includes('4096') || body.size?.includes('4704') || body.size?.includes('5504') || body.size?.includes('6240') ? '4K' : '2K'),
                aspectRatio: body.aspectRatio || null,
                watermark: body.watermark,
                numReferenceImages: Array.isArray(image) ? image.length : 1,
                referenceImageUrls: body.referenceImageUrls || [],
                generatedAt: new Date().toISOString(),
                vaultProfileId: body.vaultProfileId || null,
              },
            },
          });

          console.log(`✅ Saved to database: ${savedImage.id}`);

          return {
            id: savedImage.id,
            url: publicUrl,
            size: item.size || body.size,
            prompt: body.prompt,
            model: data.model,
            createdAt: savedImage.createdAt.toISOString(),
          };
        }

      } catch (error: any) {
        console.error(`❌ Error processing image ${index}:`, error);
        return null; // Return null for failed images
      }
    });

    // Wait for all images to process in parallel
    const savedImagesResults = await Promise.all(imageProcessingPromises);
    const savedImages = savedImagesResults.filter((img): img is NonNullable<typeof img> => img !== null);

    console.log(`✅ Successfully saved ${savedImages.length}/${data.data.length} images in parallel`);

    // Extract images from response
    const images = savedImages.length > 0 ? savedImages : data.data?.map((item: any) => ({
      url: item.url,
      b64_json: item.b64_json,
      size: size,
    })) || [];

    return NextResponse.json({
      success: true,
      images,
      metadata: {
        model,
        size,
        prompt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Image-to-Image generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint for fetching generation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profileId from query params to filter by profile
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const isAllProfiles = profileId === 'all';

    console.log('📋 Fetching SeeDream I2I history for user:', userId, 'profileId:', profileId, 'isAllProfiles:', isAllProfiles);

    // If viewing all profiles, get profile map for name lookups
    let profileMap: Record<string, string> = {};
    if (isAllProfiles) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: userId },
        select: { id: true, name: true, instagramUsername: true },
      });
      profileMap = profiles.reduce((acc, p) => {
        acc[p.id] = p.instagramUsername ? `@${p.instagramUsername}` : p.name;
        return acc;
      }, {} as Record<string, string>);
    }

    // First get generation jobs that are SeeDream I2I type
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: userId,
        type: 'IMAGE_TO_IMAGE',
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
      select: {
        id: true,
        params: true,
      },
    });

    // Filter to only SeeDream I2I jobs (and optionally by profileId)
    const seedreamJobIds = recentJobs
      .filter((job) => {
        const params = job.params as any;
        const isSeeDreamI2I = params?.source === 'seedream-i2i';
        // If profileId is provided (and not "all"), filter to only jobs for that profile
        if (profileId && !isAllProfiles && params?.vaultProfileId) {
          return isSeeDreamI2I && params.vaultProfileId === profileId;
        }
        return isSeeDreamI2I;
      })
      .map((job) => job.id);

    console.log('📋 Found SeeDream I2I job IDs:', seedreamJobIds.length);

    // Fetch images from GeneratedImage table
    let generatedImages: any[] = [];
    if (seedreamJobIds.length > 0) {
      generatedImages = await prisma.generatedImage.findMany({
        where: {
          clerkId: userId,
          jobId: {
            in: seedreamJobIds,
          },
          awsS3Url: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });
      
      // Filter by profileId from metadata if provided (and not "all")
      if (profileId && !isAllProfiles) {
        generatedImages = generatedImages.filter((img) => {
          const metadata = img.metadata as any;
          return metadata?.vaultProfileId === profileId;
        });
      }
    }

    console.log('📋 Found generated images:', generatedImages.length);

    // Also fetch vault items that were created from SeeDream I2I
    // Need to check both: items where clerkId matches (own profile) OR items generated by this user (shared profile)
    const vaultWhere: any = {
      fileType: { in: ['image/png', 'image/jpeg'] }, // Support both PNG (4.5) and JPEG (5.0 LITE)
      OR: [
        { clerkId: userId }, // Items on own profiles
        // Items generated by this user on shared profiles are found via metadata filtering below
      ],
    };
    
    // Filter by profileId if provided (and not "all")
    if (profileId && !isAllProfiles) {
      vaultWhere.profileId = profileId;
      // For specific profile, also get items where user generated on a shared profile
      vaultWhere.OR = [
        { clerkId: userId, profileId },
        { profileId }, // Will filter by generatedByClerkId below
      ];
    }
    
    const allVaultImages = await prisma.vaultItem.findMany({
      where: vaultWhere,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // Filter to only SeeDream I2I generated images
    // Also include items where this user generated on a shared profile
    const vaultImages = allVaultImages.filter((img) => {
      const metadata = img.metadata as any;
      const isSeeDreamI2I = metadata?.source === 'seedream-i2i';
      if (!isSeeDreamI2I) return false;
      
      // Include if: user owns the item OR user generated the item (on shared profile)
      const isOwned = img.clerkId === userId;
      const isGenerated = metadata?.generatedByClerkId === userId;
      return isOwned || isGenerated;
    }).slice(0, 20);

    console.log('📋 Found vault images:', vaultImages.length);

    // Map generated images with full metadata for reuse
    const mappedGeneratedImages = generatedImages.map((img) => {
      const metadata = img.metadata as any;
      const imgProfileId = metadata?.vaultProfileId || null;
      return {
        id: img.id,
        imageUrl: convertS3ToCdnUrl(img.awsS3Url) || '',
        prompt: metadata?.prompt || '',
        modelVersion: metadata?.model || 'SeeDream 4.5',
        size: img.width && img.height ? `${img.width}x${img.height}` : (metadata?.size || 'Unknown'),
        createdAt: img.createdAt.toISOString(),
        status: 'completed' as const,
        source: 'generated' as const,
        profileName: isAllProfiles && imgProfileId ? profileMap[imgProfileId] || null : null,
        // Include full metadata for reuse functionality
        metadata: {
          resolution: metadata?.resolution || '2K',
          aspectRatio: metadata?.aspectRatio || null,
          watermark: metadata?.watermark || false,
          numReferenceImages: metadata?.numReferenceImages || 1,
          referenceImageUrls: metadata?.referenceImageUrls || [],
          profileId: imgProfileId,
        },
      };
    });

    // Map vault images with full metadata for reuse
    const mappedVaultImages = vaultImages.map((img) => {
      const metadata = img.metadata as any;
      return {
        id: img.id,
        imageUrl: convertS3ToCdnUrl(img.awsS3Url) || '',
        prompt: metadata?.prompt || '',
        modelVersion: metadata?.model || 'SeeDream 4.5',
        size: metadata?.size || 'Unknown',
        createdAt: img.createdAt.toISOString(),
        status: 'completed' as const,
        source: 'vault' as const,
        profileId: img.profileId,
        profileName: isAllProfiles && img.profileId ? profileMap[img.profileId] || null : null,
        // Include full metadata for reuse functionality
        metadata: {
          resolution: metadata?.resolution || '2K',
          aspectRatio: metadata?.aspectRatio || null,
          watermark: metadata?.watermark || false,
          numReferenceImages: metadata?.numReferenceImages || 1,
          referenceImageUrls: metadata?.referenceImageUrls || [],
          profileId: img.profileId,
        },
      };
    });

    // Combine and sort by date
    const allImages = [...mappedGeneratedImages, ...mappedVaultImages]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    console.log('📋 Returning total images:', allImages.length);
    console.log('📋 Image URLs present:', allImages.filter(i => !!i.imageUrl).length);

    return NextResponse.json({ images: allImages });
  } catch (error: any) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
