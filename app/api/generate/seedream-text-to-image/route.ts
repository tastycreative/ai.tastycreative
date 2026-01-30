import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

// Vercel function configuration - extend timeout for image generation
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max (Pro plan)
export const dynamic = 'force-dynamic';

// BytePlus ModelArk API configuration for SeeDream 4.5
const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_API_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';

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

interface SeeDreamRequest {
  prompt: string;
  model?: string;
  size?: string;
  watermark?: boolean;
  negative_prompt?: string;
  sequential_image_generation?: 'auto' | 'disabled';
  sequential_image_generation_options?: {
    max_images?: number;
  };
  response_format?: 'url' | 'b64_json';
  stream?: boolean;
  targetFolder?: string;
  // Profile association (always sent for history filtering)
  vaultProfileId?: string;
  // Vault folder support (only when saving directly to vault)
  saveToVault?: boolean;
  vaultFolderId?: string;
  // Additional metadata fields
  resolution?: string;
  aspectRatio?: string;
}

interface SeeDreamResponse {
  model: string;
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    size?: string;
  }>;
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate API key
    if (!ARK_API_KEY) {
      console.error('❌ Missing ARK API key configuration');
      return NextResponse.json(
        { error: 'SeeDream API configuration missing' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: SeeDreamRequest = await request.json();
    const { 
      prompt, 
      model = 'ep-20260103160511-gxx75',
      size = '2K',
      watermark = false,
      negative_prompt,
      sequential_image_generation = 'disabled',
      sequential_image_generation_options,
      response_format = 'url',
      stream = false
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎨 Starting SeeDream 4.5 generation for user:', userId);
    console.log('📋 Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
    console.log('📐 Size:', size);
    console.log('🎭 Batch mode:', sequential_image_generation);
    console.log('🔢 Batch options:', sequential_image_generation_options);

    // Build request payload
    const payload: any = {
      model,
      prompt: prompt.trim(),
      size,
      watermark,
      response_format,
      stream,
    };

    // Add optional parameters
    if (negative_prompt && negative_prompt.trim()) {
      payload.negative_prompt = negative_prompt.trim();
    }

    if (sequential_image_generation !== 'disabled') {
      payload.sequential_image_generation = sequential_image_generation;
      
      if (sequential_image_generation_options) {
        payload.sequential_image_generation_options = sequential_image_generation_options;
      }
    }

    console.log('📤 Sending request to BytePlus ModelArk API...');
    console.log('📦 Full payload:', JSON.stringify(payload, null, 2));

    // Call BytePlus ModelArk API
    const response = await fetch(ARK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('📥 API Response status:', response.status);

    if (!response.ok) {
      console.error('❌ SeeDream API error:', responseText);
      console.error('❌ Full error response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      let errorMessage = 'Failed to generate images';
      let errorDetails = null;
      
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch (e) {
        // If response is not JSON, use the text
        errorMessage = responseText || errorMessage;
      }

      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails 
        },
        { status: response.status }
      );
    }

    const data: SeeDreamResponse = JSON.parse(responseText);
    
    console.log('✅ Generation successful!');
    console.log('📊 Usage:', data.usage);
    console.log('🖼️ Generated images:', data.data.length);

    // Create generation job in database
    const generationJob = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: 'COMPLETED',
        type: 'TEXT_TO_IMAGE',
        progress: 100,
        params: {
          source: 'seedream',
          prompt: body.prompt,
          model: body.model || 'ep-20260103160511-gxx75',
          size: body.size,
          watermark: body.watermark,
          negative_prompt: body.negative_prompt,
          targetFolder: body.targetFolder,
          saveToVault: body.saveToVault,
          vaultProfileId: body.vaultProfileId,
          vaultFolderId: body.vaultFolderId,
        },
      },
    });

    console.log('📝 Created generation job:', generationJob.id);

    // Check if saving to vault - verify folder exists and user has access
    let vaultFolder = null;
    if (body.saveToVault && body.vaultProfileId && body.vaultFolderId) {
      // First check if user owns the folder
      vaultFolder = await prisma.vaultFolder.findFirst({
        where: {
          id: body.vaultFolderId,
          clerkId: userId,
          profileId: body.vaultProfileId,
        },
      });

      // If not owned, check if folder is shared with user OR if profile is shared via organization
      if (!vaultFolder) {
        // Get the user's internal ID for organization membership checks
        const currentUser = await prisma.user.findUnique({
          where: { clerkId: userId },
          select: { id: true, currentOrganizationId: true },
        });

        // Get the profile to check organization membership
        const profile = await prisma.instagramProfile.findUnique({
          where: { id: body.vaultProfileId },
          select: {
            id: true,
            clerkId: true,
            organizationId: true,
          },
        });

        // Check if user has access via organization
        let isOrgMember = false;
        
        if (profile?.organizationId && currentUser) {
          if (currentUser.currentOrganizationId === profile.organizationId) {
            isOrgMember = true;
          } else {
            const membership = await prisma.teamMember.findFirst({
              where: {
                userId: currentUser.id,
                organizationId: profile.organizationId,
              },
            });
            isOrgMember = !!membership;
          }
        }

        console.log('🔍 T2I Access check:', {
          userId,
          userInternalId: currentUser?.id,
          profileId: body.vaultProfileId,
          profileOrgId: profile?.organizationId,
          userCurrentOrgId: currentUser?.currentOrganizationId,
          isOrgMember,
        });

        if (isOrgMember) {
          // User has access to the profile through organization membership
          vaultFolder = await prisma.vaultFolder.findFirst({
            where: {
              id: body.vaultFolderId,
              profileId: body.vaultProfileId,
            },
          });

          if (vaultFolder) {
            console.log('📂 Using organization shared vault folder:', vaultFolder.name);
          }
        } else {
          // Check if folder is explicitly shared via VaultFolderShare
          const sharedFolder = await prisma.vaultFolder.findFirst({
            where: {
              id: body.vaultFolderId,
              profileId: body.vaultProfileId,
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

    // Process and save each generated image
    const savedImages = [];
    
    for (let index = 0; index < data.data.length; index++) {
      const item = data.data[index];
      
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
          continue;
        }

        // Generate filename
        const timestamp = Date.now();
        const filename = `seedream-${timestamp}-${index}.png`;
        
        // Determine S3 key based on storage type (vault vs regular S3)
        let s3Key: string;
        let subfolder = '';
        let publicUrl: string;
        
        if (body.saveToVault && body.vaultProfileId && body.vaultFolderId && vaultFolder) {
          // Save to vault storage: vault/{ownerClerkId}/{profileId}/{folderId}/{fileName}
          // Use the folder owner's clerkId (vaultFolder.clerkId), not current user's
          s3Key = `vault/${vaultFolder.clerkId}/${body.vaultProfileId}/${body.vaultFolderId}/${filename}`;
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
          ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000',
        });

        await s3Client.send(uploadCommand);

        // Generate public URL
        publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

        console.log(`✅ Image uploaded: ${publicUrl}`);

        // Save to database - different handling for vault vs regular
        const [width, height] = (item.size || body.size || '2048x2048').split('x').map(Number);
        
        if (body.saveToVault && body.vaultProfileId && body.vaultFolderId && vaultFolder) {
          // Save to vault database with generation metadata
          // Use vaultFolder.clerkId (the profile owner's clerkId) so the item appears in the vault
          const vaultItem = await prisma.vaultItem.create({
            data: {
              clerkId: vaultFolder.clerkId, // Use folder owner's clerkId, not current user
              profileId: body.vaultProfileId,
              folderId: body.vaultFolderId,
              fileName: filename,
              fileType: 'image/png',
              fileSize: imageBuffer.length,
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: {
                source: 'seedream-t2i',
                generationType: 'text-to-image',
                model: data.model || model,
                prompt: body.prompt,
                negativePrompt: body.negative_prompt || null,
                size: item.size || body.size,
                resolution: body.resolution || '2K',
                aspectRatio: body.aspectRatio || null,
                watermark: body.watermark,
                generatedAt: new Date().toISOString(),
                generatedByClerkId: userId, // Track who actually generated it
              },
            },
          });

          console.log(`✅ Saved to vault database: ${vaultItem.id}`);

          savedImages.push({
            id: vaultItem.id,
            url: publicUrl,
            size: item.size || body.size,
            prompt: body.prompt,
            model: data.model,
            createdAt: vaultItem.createdAt.toISOString(),
            savedToVault: true,
          });
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
              format: 'png',
              awsS3Key: s3Key,
              awsS3Url: publicUrl,
              metadata: {
                source: 'seedream',
                model: data.model,
                prompt: body.prompt,
                negative_prompt: body.negative_prompt,
                size: body.size,
                resolution: body.resolution || '2K',
                aspectRatio: body.aspectRatio || null,
                watermark: body.watermark,
                vaultProfileId: body.vaultProfileId || null,
                generatedAt: new Date(data.created * 1000).toISOString(),
              },
            },
          });

          console.log(`✅ Saved to database: ${savedImage.id}`);

          savedImages.push({
            id: savedImage.id,
            url: publicUrl,
            size: item.size || body.size,
            prompt: body.prompt,
            model: data.model,
            createdAt: savedImage.createdAt.toISOString(),
          });
        }

      } catch (error: any) {
        console.error(`❌ Error processing image ${index}:`, error);
        // Continue with other images even if one fails
      }
    }

    console.log(`✅ Successfully saved ${savedImages.length}/${data.data.length} images`);

    // Transform response for frontend
    const images = savedImages.length > 0 ? savedImages : data.data.map((item, index) => ({
      id: `${Date.now()}_${index}`,
      url: item.url || `data:image/jpeg;base64,${item.b64_json}`,
      size: item.size,
      prompt,
      model: data.model,
      createdAt: new Date(data.created * 1000).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      images,
      usage: data.usage,
      model: data.model,
    });

  } catch (error: any) {
    console.error('❌ Error in SeeDream generation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for generation history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get profileId from query params to filter by profile
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const isAllProfiles = profileId === 'all';

    console.log('📋 Fetching SeeDream T2I history for user:', userId, 'profileId:', profileId);

    // Get profile names map if viewing all profiles
    let profileMap: Record<string, { name: string; username: string | null }> = {};
    if (isAllProfiles) {
      const userProfiles = await prisma.instagramProfile.findMany({
        where: { clerkId: userId },
        select: { id: true, name: true, instagramUsername: true },
      });
      profileMap = Object.fromEntries(
        userProfiles.map((p) => [p.id, { name: p.name, username: p.instagramUsername }])
      );
    }

    // Fetch recent SeeDream generations from database
    // First get generation jobs that are SeeDream type
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: userId,
        type: 'TEXT_TO_IMAGE',
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Get more jobs to filter
      select: {
        id: true,
        params: true,
      },
    });

    // Filter to only SeeDream jobs (and optionally by profileId)
    const seedreamJobIds = recentJobs
      .filter((job) => {
        const params = job.params as any;
        const isSeeDream = params?.source === 'seedream';
        if (!isSeeDream) return false;
        
        // If viewing all profiles, include all jobs
        if (isAllProfiles) return true;
        
        // If profileId filter is provided, include jobs that:
        // 1. Match the profileId exactly, OR
        // 2. Have no profileId set (legacy/unassociated images)
        if (profileId) {
          const jobProfileId = params?.vaultProfileId;
          // Include if matches profile OR if no profile was set (show in all profiles)
          return jobProfileId === profileId || !jobProfileId;
        }
        return true;
      })
      .map((job) => job.id);

    console.log('📋 Found SeeDream job IDs:', seedreamJobIds.length);

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
      
      // Filter by profileId from metadata if provided (not for all profiles)
      if (profileId && !isAllProfiles) {
        generatedImages = generatedImages.filter((img) => {
          const metadata = img.metadata as any;
          const imgProfileId = metadata?.vaultProfileId;
          // Include if matches profile OR if no profile was set (show in all profiles)
          return imgProfileId === profileId || !imgProfileId;
        });
      }
    }

    console.log('📋 Found generated images:', generatedImages.length);

    // Also fetch vault items that were created from SeeDream
    // Need to check both: items where clerkId matches (own profile) OR items generated by this user (shared profile)
    const vaultWhere: any = {
      fileType: 'image/png',
      OR: [
        { clerkId: userId }, // Items on own profiles
      ],
    };
    
    // Filter by profileId if provided (not for all profiles)
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
      take: 100, // Get more to filter
    });

    // Filter to only SeeDream generated images
    // Also include items where this user generated on a shared profile
    const vaultImages = allVaultImages.filter((img) => {
      const metadata = img.metadata as any;
      const isSeeDreamT2I = metadata?.source === 'seedream-t2i';
      if (!isSeeDreamT2I) return false;
      
      // Include if: user owns the item OR user generated the item (on shared profile)
      const isOwned = img.clerkId === userId;
      const isGenerated = metadata?.generatedByClerkId === userId;
      return isOwned || isGenerated;
    }).slice(0, 20);

    console.log('📋 Found vault images:', vaultImages.length);

    // Map generated images with full metadata for reuse
    const mappedGeneratedImages = generatedImages.map((img) => {
      const metadata = img.metadata as any;
      const imgProfileId = metadata?.vaultProfileId;
      return {
        id: img.id,
        imageUrl: img.awsS3Url || '',
        prompt: metadata?.prompt || '',
        modelVersion: metadata?.model || 'SeeDream 4.5',
        size: img.width && img.height ? `${img.width}x${img.height}` : (metadata?.size || 'Unknown'),
        createdAt: img.createdAt.toISOString(),
        status: 'completed' as const,
        source: 'generated' as const,
        // Include profile name when viewing all profiles
        profileName: isAllProfiles && imgProfileId ? profileMap[imgProfileId]?.name || null : null,
        // Include full metadata for reuse functionality
        metadata: {
          resolution: metadata?.resolution || '2K',
          aspectRatio: metadata?.aspectRatio || null,
          watermark: metadata?.watermark || false,
          negativePrompt: metadata?.negative_prompt || '',
          profileId: imgProfileId || null,
        },
      };
    });

    // Map vault images
    const mappedVaultImages = vaultImages.map((img) => {
      const metadata = img.metadata as any;
      return {
        id: img.id,
        imageUrl: img.awsS3Url || '',
        prompt: metadata?.prompt || '',
        modelVersion: metadata?.model || 'SeeDream 4.5',
        size: metadata?.size || 'Unknown',
        createdAt: img.createdAt.toISOString(),
        status: 'completed' as const,
        source: 'vault' as const,
        profileId: img.profileId,
        // Include profile name when viewing all profiles
        profileName: isAllProfiles ? profileMap[img.profileId]?.name || null : null,
        // Include full metadata for reuse functionality
        metadata: {
          resolution: metadata?.resolution || '2K',
          aspectRatio: metadata?.aspectRatio || null,
          watermark: metadata?.watermark || false,
          negativePrompt: metadata?.negative_prompt || '',
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

    return NextResponse.json({
      images: allImages,
    });

  } catch (error: any) {
    console.error('❌ Error fetching history:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
