import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import * as jose from "jose";
import { deductCredits } from '@/lib/credits';
import { trackStorageUpload } from '@/lib/storageEvents';
import { convertS3ToCdnUrl } from '@/lib/cdnUtils';

// Vercel function configuration - extend timeout for video generation
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max (Pro plan)
export const dynamic = "force-dynamic";

// Kling API Configuration
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY!;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY!;
const KLING_API_URL = "https://api.klingai.com/v1/videos/multi-image2video";

// AWS S3 Configuration
const AWS_REGION = "us-east-1";
const AWS_S3_BUCKET = "tastycreative";

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Generate JWT token for Kling API authentication
async function generateKlingToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: KLING_ACCESS_KEY,
    exp: now + 1800, // 30 minutes expiry
    nbf: now - 5, // Valid from 5 seconds ago
  };

  const secretKey = new TextEncoder().encode(KLING_SECRET_KEY);
  
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(secretKey);

  return token;
}

// Upload image to S3 and return URL
async function uploadImageToS3(imageBuffer: Buffer, filename: string, userId: string): Promise<string> {
  const s3Key = `temp/${userId}/${filename}`;
  
  const uploadCommand = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: "image/jpeg",
  });

  await s3Client.send(uploadCommand);
  
  const imageUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");
  return imageUrl;
}

// Upload video to S3
async function uploadVideoToS3(videoBuffer: Buffer, filename: string, userId: string, targetFolder?: string): Promise<string> {
  let s3Key: string;
  
  if (targetFolder && targetFolder.trim() !== "") {
    // Use specified target folder
    s3Key = `${targetFolder.replace(/^\/+|\/+$/g, "")}/${filename}`;
  } else {
    // Default to outputs folder with timestamp
    const now = new Date();
    const dateStr = `${now.toLocaleString("en-US", { month: "short" }).toLowerCase()}-${now.getDate()}`;
    s3Key = `outputs/${userId}/${dateStr}/${filename}`;
  }

  const uploadCommand = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: s3Key,
    Body: videoBuffer,
    ContentType: "video/mp4",
  });

  await s3Client.send(uploadCommand);

  const videoUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");
  return videoUrl;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    
    const images: File[] = [];
    const imageFields = ["image1", "image2", "image3", "image4", "image5"];
    
    for (const field of imageFields) {
      const image = formData.get(field) as File | null;
      if (image) {
        images.push(image);
      }
    }

    const prompt = formData.get("prompt") as string | null;
    const negative_prompt = formData.get("negative_prompt") as string | null;
    const model = (formData.get("model") as string) || (formData.get("model_name") as string) || "kling-v1-6";
    const mode = (formData.get("mode") as string) || "std";
    const duration = (formData.get("duration") as string) || "5";
    const cfg_scale = parseFloat((formData.get("cfg_scale") as string) || "0.5");
    const aspect_ratio = (formData.get("aspect_ratio") as string) || "16:9";
    const targetFolder = formData.get("targetFolder") as string | null;
    const saveToVault = formData.get("saveToVault") === "true";
    const vaultProfileId = formData.get("vaultProfileId") as string | null;
    const vaultFolderId = formData.get("vaultFolderId") as string | null;
    const organizationSlug = formData.get("organizationSlug") as string | null;

    // Validate required fields (at least 2 images required)
    if (images.length < 2) {
      return NextResponse.json({ error: "At least 2 images are required" }, { status: 400 });
    }

    if (images.length > 4) {
      return NextResponse.json({ error: "Maximum 4 images allowed" }, { status: 400 });
    }

    // Get user's organization for credit deduction
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      );
    }

    // Dynamically determine feature key from URL path
    const featureKey = 'kling_multi_image_to_video';

    // Deduct credits before making the API call
    const creditResult = await deductCredits(
      user.currentOrganizationId,
      featureKey,
      user.id
    );

    if (!creditResult.success) {
      return NextResponse.json({
        error: creditResult.error || 'Failed to deduct credits',
        insufficientCredits: creditResult.error?.includes('Insufficient credits')
      }, { status: 400 });
    }

    console.log(`💳 Credits deducted: ${creditResult.creditsDeducted}, Remaining: ${creditResult.remainingCredits}`);

    // Upload all images to S3 IN PARALLEL (much faster!)
    // API expects image_list as array of objects with "image" key (not "url")
    console.log(`⚡ Uploading ${images.length} images to S3 in parallel...`);
    
    const imageUploadPromises = images.map(async (imageFile, i) => {
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      const imageFilename = `kling-multi-i2v-source-${Date.now()}-${i + 1}.jpg`;
      const imageUrl = await uploadImageToS3(imageBuffer, imageFilename, userId);
      console.log(`[Kling Multi-I2V] Image ${i + 1} uploaded to:`, imageUrl);
      // Format: array of objects with "image" key as per Kling API docs
      return { image: imageUrl };
    });

    const imageList = await Promise.all(imageUploadPromises);
    console.log(`✅ All ${imageList.length} images uploaded in parallel`);

    // Prepare Kling API request payload according to Kling API spec
    // The multi-image2video endpoint expects 'image_list' as an array of objects with "image" key
    const payload: Record<string, unknown> = {
      model_name: model,
      image_list: imageList,
      prompt: prompt || "", // prompt is REQUIRED for multi-image-to-video
      mode: mode,
      duration: duration,
      aspect_ratio: aspect_ratio,
    };

    // Add optional parameters
    if (negative_prompt) payload.negative_prompt = negative_prompt;

    console.log("[Kling Multi-I2V] Sending request with payload:", JSON.stringify(payload, null, 2));

    // Generate authentication token
    const token = await generateKlingToken();

    // Call Kling API to create task
    const response = await fetch(KLING_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("[Kling Multi-I2V] Raw response:", responseText);

    if (!response.ok) {
      console.error("[Kling Multi-I2V] API error response:", {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      return NextResponse.json(
        {
          error: `Kling API error: ${response.statusText}`,
          details: responseText,
        },
        { status: response.status }
      );
    }

    const result = JSON.parse(responseText);
    console.log("[Kling Multi-I2V] API response:", {
      code: result.code,
      message: result.message,
      hasData: !!result.data,
      taskId: result.data?.task_id,
    });

    if (result.code !== 0) {
      console.error("[Kling Multi-I2V] API returned error code:", result);
      return NextResponse.json(
        {
          error: result.message || "Failed to create video generation task",
          code: result.code,
        },
        { status: 400 }
      );
    }

    const taskId = result.data?.task_id;
    if (!taskId) {
      console.error("[Kling Multi-I2V] No task_id in response:", result);
      return NextResponse.json(
        { error: "No task ID returned from Kling API" },
        { status: 500 }
      );
    }

    // Extract source image URLs for reuse feature
    const sourceImageUrls = imageList.map(item => item.image);

    // Create GenerationJob in database
    const generationJob = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        status: "PROCESSING",
        type: "VIDEO_TO_VIDEO", // Using VIDEO_TO_VIDEO as placeholder for multi-image
        progress: 0,
        comfyUIPromptId: taskId,
        params: {
          prompt,
          negative_prompt,
          model,
          mode,
          duration,
          cfg_scale,
          aspect_ratio,
          image_count: images.length,
          sourceImageUrls,
          targetFolder,
          saveToVault,
          vaultProfileId,
          vaultFolderId,
          organizationSlug,
          source: "kling-multi-i2v",
        },
        stage: "Initializing",
        message: "Multi-image video generation started",
      },
    });

    console.log("[Kling Multi-I2V] Created GenerationJob:", generationJob.id);

    return NextResponse.json({
      success: true,
      taskId: taskId,
      jobId: generationJob.id,
      message: "Multi-image to video generation started",
      estimatedTime: "60-120 seconds",
    });

  } catch (error) {
    console.error("[Kling Multi-I2V] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check task status or retrieve history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const history = searchParams.get("history");
    const filterProfileId = searchParams.get("profileId");

    // If requesting history
    if (history === "true") {
      const isAllProfiles = filterProfileId === "all";
      console.log("[Kling Multi-I2V] Fetching video history for user:", userId, "profileId:", filterProfileId, "isAllProfiles:", isAllProfiles);

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

      // Step 1: Get generation jobs first, then filter by source in JS for reliability
      const recentJobs = await prisma.generationJob.findMany({
        where: {
          clerkId: userId,
          type: "VIDEO_TO_VIDEO",
          status: "COMPLETED",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
        select: {
          id: true,
          params: true,
        },
      });

      // Filter to only Kling Multi-I2V jobs (and optionally by profile)
      const klingJobIds = recentJobs
        .filter((job) => {
          const params = job.params as any;
          if (params?.source !== "kling-multi-i2v") return false;
          // Filter by profile if specified (and not "all")
          if (filterProfileId && !isAllProfiles) {
            return params?.vaultProfileId === filterProfileId;
          }
          return true;
        })
        .map((job) => job.id);

      console.log("[Kling Multi-I2V] Found Kling job IDs:", klingJobIds.length);

      // Step 2: Fetch jobs with their videos
      let jobs: any[] = [];
      if (klingJobIds.length > 0) {
        jobs = await prisma.generationJob.findMany({
          where: {
            id: {
              in: klingJobIds,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            videos: true,
          },
        });
      }

      console.log("[Kling Multi-I2V] Found jobs with videos:", jobs.length);

      // Step 3: Also fetch vault items that were created from Kling Multi-I2V
      // Need to check both: items where clerkId matches (own profile) OR items generated by this user (shared profile)
      const vaultQuery: any = {
        fileType: {
          startsWith: "video/",
        },
        OR: [
          { clerkId: userId }, // Items on own profiles
        ],
      };
      
      // Add profile filter if specified (and not "all")
      if (filterProfileId && !isAllProfiles) {
        vaultQuery.profileId = filterProfileId;
        // For specific profile, also get items where user generated on a shared profile
        vaultQuery.OR = [
          { clerkId: userId, profileId: filterProfileId },
          { profileId: filterProfileId }, // Will filter by generatedByClerkId below
        ];
      }
      
      const allVaultVideos = await prisma.vaultItem.findMany({
        where: vaultQuery,
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      });

      // Filter to only Kling Multi-I2V generated videos
      // Also include items where this user generated on a shared profile
      const vaultVideos = allVaultVideos
        .filter((vid) => {
          const metadata = vid.metadata as any;
          const isKlingMultiI2V = metadata?.source === "kling-multi-i2v";
          if (!isKlingMultiI2V) return false;
          
          // Include if: user owns the item OR user generated the item (on shared profile)
          const isOwned = vid.clerkId === userId;
          const isGenerated = metadata?.generatedByClerkId === userId;
          return isOwned || isGenerated;
        })
        .slice(0, 20);

      console.log("[Kling Multi-I2V] Found vault videos:", vaultVideos.length);

      // Map generated videos from jobs
      const mappedGeneratedVideos = jobs
        .filter(job => job.videos.length > 0)
        .map(job => {
          const params = job.params as any;
          const videoMetadata = job.videos[0]?.metadata as any;
          const videoProfileId = params?.vaultProfileId || null;
          return {
            id: job.id,
            videoUrl: convertS3ToCdnUrl(job.videos[0]?.awsS3Url) || job.videos[0]?.networkVolumePath || "",
            prompt: params?.prompt || videoMetadata?.prompt || "",
            model: params?.model || videoMetadata?.model || "kling-v1-6",
            mode: params?.mode || videoMetadata?.mode || "std",
            duration: params?.duration || videoMetadata?.duration || "5",
            aspectRatio: params?.aspect_ratio || videoMetadata?.aspectRatio || "16:9",
            imageCount: params?.image_count || videoMetadata?.imageCount || 0,
            cfgScale: params?.cfg_scale || videoMetadata?.cfgScale || 0.5,
            negativePrompt: params?.negative_prompt || videoMetadata?.negativePrompt || "",
            sourceImageUrls: params?.sourceImageUrls || videoMetadata?.sourceImageUrls || [],
            createdAt: job.createdAt.toISOString(),
            status: "completed" as const,
            source: "generated" as const,
            profileName: isAllProfiles && videoProfileId ? profileMap[videoProfileId] || null : null,
            metadata: {
              ...videoMetadata,
              prompt: params?.prompt || videoMetadata?.prompt || "",
              negativePrompt: params?.negative_prompt || videoMetadata?.negativePrompt || "",
              model: params?.model || videoMetadata?.model || "kling-v1-6",
              mode: params?.mode || videoMetadata?.mode || "std",
              duration: params?.duration || videoMetadata?.duration || "5",
              aspectRatio: params?.aspect_ratio || videoMetadata?.aspectRatio || "16:9",
              imageCount: params?.image_count || videoMetadata?.imageCount || 0,
              cfgScale: params?.cfg_scale || videoMetadata?.cfgScale || 0.5,
              sourceImageUrls: params?.sourceImageUrls || videoMetadata?.sourceImageUrls || [],
              profileId: videoProfileId,
            },
          };
        });

      // Get the video URLs from generation jobs to filter out duplicates
      const generatedVideoUrls = new Set(mappedGeneratedVideos.map(v => v.videoUrl).filter(Boolean));

      // Map vault videos, but exclude those that already exist in generation jobs
      const mappedVaultVideos = vaultVideos
        .filter((vid) => !generatedVideoUrls.has(vid.awsS3Url || ""))
        .map((vid) => {
          const metadata = vid.metadata as any;
          return {
            id: vid.id,
            videoUrl: convertS3ToCdnUrl(vid.awsS3Url) || "",
            prompt: metadata?.prompt || "",
            model: metadata?.model || "kling-v1-6",
            mode: metadata?.mode || "std",
            duration: metadata?.duration || "5",
            aspectRatio: metadata?.aspectRatio || "16:9",
            imageCount: metadata?.imageCount || metadata?.image_count || 0,
            cfgScale: metadata?.cfgScale || 0.5,
            negativePrompt: metadata?.negativePrompt || "",
            sourceImageUrls: metadata?.sourceImageUrls || [],
            createdAt: vid.createdAt.toISOString(),
            status: "completed" as const,
            source: "vault" as const,
            metadata: metadata,
          };
        });

      // Combine and sort by date - no more duplicates since we filtered vault videos
      const allVideos = [...mappedGeneratedVideos, ...mappedVaultVideos]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);

      console.log("[Kling Multi-I2V] Returning total videos:", allVideos.length);

      return NextResponse.json({
        success: true,
        videos: allVideos,
      });
    }

    // If checking task status
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Generate authentication token
    const token = await generateKlingToken();

    // Query Kling API for task status
    const statusUrl = `https://api.klingai.com/v1/videos/multi-image2video/${taskId}`;
    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    const statusText = await statusResponse.text();
    console.log("[Kling Multi-I2V Status] Raw response:", statusText);

    if (!statusResponse.ok) {
      console.error("[Kling Multi-I2V Status] Error:", {
        status: statusResponse.status,
        body: statusText,
      });
      return NextResponse.json(
        { error: `Failed to check status: ${statusResponse.statusText}` },
        { status: statusResponse.status }
      );
    }

    const statusResult = JSON.parse(statusText);
    console.log("[Kling Multi-I2V Status] Parsed:", statusResult);

    // Update database based on status
    const job = await prisma.generationJob.findFirst({
      where: {
        comfyUIPromptId: taskId,
        clerkId: userId,
      },
    });

    if (job) {
      const taskStatus = statusResult.data?.task_status;
      const taskStatusMessage = statusResult.data?.task_status_msg;

      let updatedJob = job;

      if (taskStatus === "succeed") {
        const videoUrl = statusResult.data?.task_result?.videos?.[0]?.url;

        if (videoUrl) {
          // Download video and upload to S3
          const videoResponse = await fetch(videoUrl);
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          const videoFilename = `kling-multi-i2v-${Date.now()}.mp4`;
          
          const params = job.params as {
            prompt?: string;
            negative_prompt?: string;
            model?: string;
            mode?: string;
            duration?: string;
            cfg_scale?: number;
            aspect_ratio?: string;
            image_count?: number;
            sourceImageUrls?: string[];
            targetFolder?: string;
            saveToVault?: boolean;
            vaultProfileId?: string;
            vaultFolderId?: string;
            organizationSlug?: string;
          };

          // Verify vault folder if saving to vault
          let vaultFolder = null;
          if (params.saveToVault && params.vaultProfileId && params.vaultFolderId) {
            // First check if user owns the folder
            vaultFolder = await prisma.vaultFolder.findFirst({
              where: {
                id: params.vaultFolderId,
                profileId: params.vaultProfileId,
                clerkId: userId,
              },
            });

            // If not owned, check if folder is shared via organization membership
            if (!vaultFolder) {
              // Get the user's internal ID for organization membership checks
              const currentUser = await prisma.user.findUnique({
                where: { clerkId: userId },
                select: { id: true, currentOrganizationId: true },
              });

              // Get the profile to check organization membership
              const profile = await prisma.instagramProfile.findUnique({
                where: { id: params.vaultProfileId },
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

              console.log('[Kling Multi-I2V] Access check:', {
                userId,
                userInternalId: currentUser?.id,
                profileId: params.vaultProfileId,
                profileOrgId: profile?.organizationId,
                userCurrentOrgId: currentUser?.currentOrganizationId,
                isOrgMember,
              });

              if (isOrgMember) {
                // User has access to the profile through organization membership
                vaultFolder = await prisma.vaultFolder.findFirst({
                  where: {
                    id: params.vaultFolderId,
                    profileId: params.vaultProfileId,
                  },
                });

                if (vaultFolder) {
                  console.log('[Kling Multi-I2V] Using organization shared vault folder:', vaultFolder.name);
                }
              }
            }
          }
          
          // Determine S3 path - use vault path for vault storage
          let s3VideoUrl: string;
          let s3Key: string;

          if (params.saveToVault && params.vaultProfileId && params.vaultFolderId && vaultFolder) {
            // Save to vault folder - use folder owner's clerkId for shared profiles
            // Use organization-based S3 structure
            s3Key = params.organizationSlug
              ? `organizations/${params.organizationSlug}/vault/${vaultFolder.clerkId}/${params.vaultProfileId}/${params.vaultFolderId}/${videoFilename}`
              : `vault/${vaultFolder.clerkId}/${params.vaultProfileId}/${params.vaultFolderId}/${videoFilename}`;

            // Upload to vault S3 path
            const uploadCommand = new PutObjectCommand({
              Bucket: AWS_S3_BUCKET,
              Key: s3Key,
              Body: videoBuffer,
              ContentType: "video/mp4",
            });
            await s3Client.send(uploadCommand);
            
            s3VideoUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");
            console.log('[Kling Multi-I2V] Video uploaded to vault S3:', s3Key);
          } else {
            // Use regular S3 upload
            const targetFolder = params.targetFolder;
            s3VideoUrl = await uploadVideoToS3(videoBuffer, videoFilename, userId, targetFolder || undefined);
            s3Key = s3VideoUrl.split(".com/")[1];
          }

          // Common metadata for both VaultItem and GeneratedVideo
          const metadata = {
            source: "kling-multi-i2v",
            profileId: params.vaultProfileId || null,
            prompt: params.prompt || "",
            negativePrompt: params.negative_prompt || "",
            model: params.model || "kling-v1-6",
            mode: params.mode || "std",
            duration: params.duration || "5",
            cfgScale: params.cfg_scale || 0.5,
            aspectRatio: params.aspect_ratio || "16:9",
            imageCount: params.image_count || 0,
            sourceImageUrls: params.sourceImageUrls || [],
            originalUrl: videoUrl,
          };

          // Save to VaultItem if vault settings are provided
          if (params.saveToVault && params.vaultProfileId && params.vaultFolderId && vaultFolder) {
            await prisma.vaultItem.create({
              data: {
                clerkId: vaultFolder.clerkId, // Use folder owner's clerkId for shared profiles
                profileId: params.vaultProfileId,
                folderId: params.vaultFolderId,
                fileName: videoFilename,
                fileType: "video/mp4",
                awsS3Key: s3Key,
                awsS3Url: s3VideoUrl,
                fileSize: videoBuffer.length,
                metadata: {
                  ...metadata,
                  generatedByClerkId: userId, // Track who actually generated it
                },
              },
            });
            console.log("[Kling Multi-I2V] Video saved to vault");

            // Track storage usage (non-blocking)
            if (videoBuffer.length > 0) {
              trackStorageUpload(vaultFolder.clerkId, videoBuffer.length).catch((error) => {
                console.error('[Kling Multi-I2V] Failed to track storage upload:', error);
              });
            }
          }

          // Create GeneratedVideo record
          const video = await prisma.generatedVideo.create({
            data: {
              clerkId: userId,
              jobId: job.id,
              filename: videoFilename,
              awsS3Url: s3VideoUrl,
              awsS3Key: s3Key,
              metadata: metadata,
            },
          });

          // Update job status
          updatedJob = await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: "COMPLETED",
              progress: 100,
              stage: "Completed",
              message: "Multi-image video generated successfully",
            },
          });

          console.log("[Kling Multi-I2V] Video saved:", video.id);
        }
      } else if (taskStatus === "failed") {
        updatedJob = await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            error: taskStatusMessage || "Video generation failed",
            stage: "Failed",
          },
        });
      } else {
        // Still processing
        updatedJob = await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: "PROCESSING",
            stage: taskStatusMessage || "Processing",
            message: taskStatusMessage,
          },
        });
      }

      return NextResponse.json({
        success: true,
        status: taskStatus,
        message: taskStatusMessage,
        job: {
          id: updatedJob.id,
          status: updatedJob.status,
          progress: updatedJob.progress,
          stage: updatedJob.stage,
          message: updatedJob.message,
        },
        videoUrl: statusResult.data?.task_result?.videos?.[0]?.url,
      });
    }

    return NextResponse.json({
      success: true,
      status: statusResult.data?.task_status,
      message: statusResult.data?.task_status_msg,
      videoUrl: statusResult.data?.task_result?.videos?.[0]?.url,
    });

  } catch (error) {
    console.error("[Kling Multi-I2V Status] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
