import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import * as jose from "jose";
import { deductCredits } from '@/lib/credits';
import { trackStorageUpload } from '@/lib/storageEvents';

// Vercel function configuration - extend timeout for video generation
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max (Pro plan)
export const dynamic = "force-dynamic";

// Kling API Configuration
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY!;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY!;
const KLING_API_URL = "https://api.klingai.com/v1/videos/image2video";

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

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    
    const image = formData.get("image") as File;
    const prompt = formData.get("prompt") as string | null;
    const negative_prompt = formData.get("negative_prompt") as string | null;
    // Accept both model_name and model for compatibility
    const model_name = formData.get("model_name") as string | null;
    const model = formData.get("model") as string | null;
    const selectedModel = model_name || model || "kling-v1-6";
    const mode = (formData.get("mode") as string) || "std";
    const duration = (formData.get("duration") as string) || "5";
    const cfg_scale = parseFloat((formData.get("cfg_scale") as string) || "0.5");
    const sound = formData.get("sound") as string | null;
    const image_mode = (formData.get("image_mode") as string) || "normal";
    const tail_image = formData.get("tail_image") as File | null;
    const camera_control_str = formData.get("camera_control") as string | null;
    const targetFolder = formData.get("targetFolder") as string | null;
    const saveToVault = formData.get("saveToVault") === "true";
    const vaultProfileId = formData.get("vaultProfileId") as string | null;
    const vaultFolderId = formData.get("vaultFolderId") as string | null;
    const organizationSlug = formData.get("organizationSlug") as string | null;

    console.log("[Kling I2V] Request received with model:", selectedModel);

    // Validate required fields
    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    // Get user's organization for credit deduction
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 400 }
      );
    }

    // Dynamically determine feature key from URL path
    const featureKey = 'kling_image_to_video';

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

    // Convert image to buffer and upload to S3
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageFilename = `kling-i2v-source-${Date.now()}.jpg`;
    const imageUrl = await uploadImageToS3(imageBuffer, imageFilename, userId);

    console.log("[Kling I2V] Image uploaded to:", imageUrl);

    // Determine if V1 model (V2+ models don't support cfg_scale)
    const isV1Model = selectedModel.includes("v1");

    // Prepare Kling API request payload
    const payload: any = {
      model_name: selectedModel,
      image: imageUrl,
      mode,
      duration,
    };

    // Add cfg_scale only for V1 models
    if (isV1Model && cfg_scale !== undefined) {
      payload.cfg_scale = cfg_scale;
    }

    // Add sound parameter for V2.6+ models
    if (sound && selectedModel.includes("v2-6")) {
      payload.sound = sound;
    }

    // Add prompt if provided
    if (prompt) {
      payload.prompt = prompt;
    }

    // Add negative prompt if provided
    if (negative_prompt) {
      payload.negative_prompt = negative_prompt;
    }

    // Handle image mode and tail image
    if (image_mode === "pro" && tail_image) {
      const tailImageBuffer = Buffer.from(await tail_image.arrayBuffer());
      const tailImageFilename = `kling-i2v-tail-${Date.now()}.jpg`;
      const tailImageUrl = await uploadImageToS3(tailImageBuffer, tailImageFilename, userId);
      payload.image_tail = tailImageUrl;
      console.log("[Kling I2V] Tail image uploaded to:", tailImageUrl);
    }

    // Add camera control if provided
    if (camera_control_str) {
      try {
        payload.camera_control = JSON.parse(camera_control_str);
      } catch (e) {
        console.warn("[Kling I2V] Failed to parse camera control:", e);
      }
    }

    // Create GenerationJob in database
    const generationJob = await prisma.generationJob.create({
      data: {
        type: "IMAGE_TO_VIDEO",
        status: "PROCESSING",
        params: {
          prompt: prompt || "",
          negative_prompt: negative_prompt || null,
          model: selectedModel,
          mode,
          duration,
          cfg_scale: isV1Model ? cfg_scale : null,
          sound: sound || null,
          image_mode,
          camera_control: camera_control_str ? JSON.parse(camera_control_str) : null,
          source: "kling-i2v",
          imageUrl: imageUrl,
          targetFolder: targetFolder || null,
          // Vault params
          saveToVault: saveToVault || false,
          vaultProfileId: vaultProfileId || null,
          vaultFolderId: vaultFolderId || null,
          organizationSlug: organizationSlug || null,
        },
        user: {
          connect: {
            clerkId: userId,
          },
        },
      },
    });

    console.log("[Kling I2V] Sending request with payload:", JSON.stringify(payload, null, 2));

    // Generate JWT token
    const token = await generateKlingToken();

    // Call Kling API to create task
    const response = await fetch(KLING_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("[Kling I2V] API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return NextResponse.json(
        {
          error: errorData.message || errorData.error || "Video generation task creation failed",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[Kling I2V] API response:", {
      code: data.code,
      message: data.message,
      taskId: data.data?.task_id,
    });

    // Check for API-level errors
    if (data.code !== 0) {
      return NextResponse.json(
        {
          error: data.message || "Video generation task creation failed",
          details: data,
        },
        { status: 400 }
      );
    }

    const taskId = data.data?.task_id;

    // Update GenerationJob with Kling taskId
    await prisma.generationJob.update({
      where: { id: generationJob.id },
      data: {
        params: {
          ...(generationJob.params as object),
          taskId: taskId,
        },
      },
    });

    // Return task ID for polling
    return NextResponse.json({
      success: true,
      taskId: taskId,
      status: "submitted",
      jobId: generationJob.id,
      metadata: {
        model,
        prompt: prompt || "",
        imageUrl,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Kling I2V] Generation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint for polling task status or fetching history
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("taskId");
    const isHistoryRequest = searchParams.get("history") === "true";

    // Handle history request
    if (isHistoryRequest) {
      try {
        // Get profileId from query params to filter by profile
        const profileId = searchParams.get("profileId");
        const isAllProfiles = profileId === "all";
        
        console.log("[Kling I2V] Fetching video history for user:", userId, "profileId:", profileId, "isAllProfiles:", isAllProfiles);

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
            type: "IMAGE_TO_VIDEO",
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

        // Filter to only Kling I2V jobs
        const klingJobIds = recentJobs
          .filter((job) => {
            const params = job.params as any;
            return params?.source === "kling-i2v";
          })
          .map((job) => job.id);

        console.log("[Kling I2V] Found Kling job IDs:", klingJobIds.length);

        // Step 2: Fetch videos for these jobs
        let videos: any[] = [];
        if (klingJobIds.length > 0) {
          videos = await prisma.generatedVideo.findMany({
            where: {
              clerkId: userId,
              jobId: {
                in: klingJobIds,
              },
              awsS3Url: {
                not: null,
              },
            },
            include: {
              job: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 20,
          });
        }

        console.log("[Kling I2V] Found generated videos:", videos.length);
        console.log("[Kling I2V] Requested profileId:", profileId);

        // Filter by profileId if provided - only include videos with matching profile
        let filteredVideos = videos;
        if (profileId && !isAllProfiles) {
          filteredVideos = videos.filter((video) => {
            const params = video.job.params as any;
            const videoProfileId = params?.vaultProfileId;
            console.log(`[Kling I2V] Video ${video.id} has profileId: ${videoProfileId}`);
            // Only include if profileId matches exactly
            return videoProfileId === profileId;
          });
        }

        console.log("[Kling I2V] Filtered videos by profile:", filteredVideos.length);

        // Map generated videos - this is the single source of truth for history
        const mappedGeneratedVideos = filteredVideos.map((video) => {
          const params = video.job.params as any;
          const videoProfileId = params?.vaultProfileId || null;
          return {
            id: video.id,
            videoUrl: video.awsS3Url || video.s3Key || "",
            prompt: params?.prompt || "",
            model: params?.model || "kling-v1",
            duration: params?.duration || "5",
            aspectRatio: "auto",
            imageUrl: params?.imageUrl || null,
            createdAt: video.createdAt.toISOString(),
            status: "completed" as const,
            source: "generated" as const,
            profileName: isAllProfiles && videoProfileId ? profileMap[videoProfileId] || null : null,
            metadata: {
              negativePrompt: params?.negative_prompt || "",
              mode: params?.mode || "std",
              cfgScale: typeof params?.cfg_scale === 'number' ? params.cfg_scale : 0.5,
              sound: params?.sound || null,
              cameraControl: params?.camera_control || null,
              imageMode: params?.image_mode || "normal",
              referenceImageUrl: params?.imageUrl || null,
              tailImageUrl: params?.tailImageUrl || null,
              profileId: videoProfileId,
            },
          };
        });

        console.log("[Kling I2V] Returning total videos:", mappedGeneratedVideos.length);

        return NextResponse.json({ videos: mappedGeneratedVideos });
      } catch (error) {
        console.error("[Kling I2V] Error fetching video history:", error);
        return NextResponse.json({ videos: [] });
      }
    }

    // Handle task polling
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Generate JWT token
    const token = await generateKlingToken();

    // Query task status from Kling API
    const statusUrl = `${KLING_API_URL}/${taskId}`;

    console.log("[Kling I2V] Polling task status:", taskId);

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Kling I2V] Status check error:", errorText);
      return NextResponse.json(
        { error: "Failed to check task status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[Kling I2V] Task status response:", {
      code: data.code,
      taskId: taskId,
      taskStatus: data.data?.task_status,
      hasVideos: !!data.data?.task_result?.videos,
    });

    // Check for API-level errors
    if (data.code !== 0) {
      return NextResponse.json({
        status: "failed",
        error: data.message || "Failed to check task status",
      });
    }

    const taskStatus = data.data?.task_status;
    const taskResult = data.data?.task_result;

    // Check if task is completed
    if (taskStatus === "succeed" && taskResult?.videos && taskResult.videos.length > 0) {
      const videoInfo = taskResult.videos[0];
      const videoUrl = videoInfo.url;

      console.log("[Kling I2V] Video URL found:", videoUrl);

      try {
        // Find the GenerationJob for this task
        const generationJob = await prisma.generationJob.findFirst({
          where: {
            clerkId: userId,
            params: {
              path: ["taskId"],
              equals: taskId,
            },
          },
        });

        if (!generationJob) {
          console.error("[Kling I2V] GenerationJob not found for taskId:", taskId);
          return NextResponse.json({
            status: "completed",
            videoUrl: videoUrl,
            taskId: taskId,
          });
        }

        const params = generationJob.params as any;
        const targetFolder = params?.targetFolder;
        const saveToVault = params?.saveToVault;
        const vaultProfileId = params?.vaultProfileId;
        const vaultFolderId = params?.vaultFolderId;
        const organizationSlug = params?.organizationSlug;

        // Verify vault folder if saving to vault
        let vaultFolder = null;
        if (saveToVault && vaultProfileId && vaultFolderId) {
          // First check if user owns the folder
          vaultFolder = await prisma.vaultFolder.findFirst({
            where: {
              id: vaultFolderId,
              profileId: vaultProfileId,
              clerkId: userId,
            },
          });

          // If not owned, check if folder is shared via organization membership
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

            console.log('[Kling I2V] Access check:', {
              userId,
              userInternalId: currentUser?.id,
              profileId: vaultProfileId,
              profileOrgId: profile?.organizationId,
              userCurrentOrgId: currentUser?.currentOrganizationId,
              isOrgMember,
            });

            if (isOrgMember) {
              // User has access to the profile through organization membership
              vaultFolder = await prisma.vaultFolder.findFirst({
                where: {
                  id: vaultFolderId,
                  profileId: vaultProfileId,
                },
              });

              if (vaultFolder) {
                console.log('[Kling I2V] Using organization shared vault folder:', vaultFolder.name);
              }
            }
          }

          if (!vaultFolder) {
            return NextResponse.json(
              { error: "Vault folder not found or access denied" },
              { status: 404 }
            );
          }
        }

        // Download video from Kling
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
          throw new Error("Failed to download video from Kling");
        }
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        // Generate filename
        const timestamp = Date.now();
        const filename = `kling-i2v-${timestamp}.mp4`;

        // Determine S3 key based on folder selection
        let s3Key: string;
        let subfolder = "";

        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          // Save to vault folder - use folder owner's clerkId for shared profiles
          // Use the organization slug passed from client
          s3Key = organizationSlug
            ? `organizations/${organizationSlug}/vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`
            : `vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`;
        } else if (targetFolder) {
          s3Key = `${targetFolder.replace(/\/$/, "")}/${filename}`;
          const parts = targetFolder.split("/");
          if (parts.length > 2) {
            subfolder = parts.slice(2).join("/").replace(/\/$/, "");
          }
        } else {
          s3Key = `outputs/${userId}/${filename}`;
        }

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
          Bucket: AWS_S3_BUCKET,
          Key: s3Key,
          Body: videoBuffer,
          ContentType: "video/mp4",
        });

        await s3Client.send(uploadCommand);
        console.log("[Kling I2V] Video uploaded to S3:", s3Key);

        const awsS3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");

        // ALWAYS create GeneratedVideo for history tracking
        const generatedVideo = await prisma.generatedVideo.create({
          data: {
            clerkId: userId,
            jobId: generationJob.id,
            filename: filename,
            subfolder: subfolder || "",
            type: "output",
            s3Key: s3Key,
            awsS3Key: s3Key,
            awsS3Url: awsS3Url,
            duration: parseFloat(params?.duration || "5"),
            format: "mp4",
            metadata: {
              source: "kling-i2v",
              prompt: params?.prompt || "",
              negative_prompt: params?.negative_prompt || "",
              model: params?.model || "kling-v1",
              mode: params?.mode || "std",
              duration: params?.duration || "5",
              cfg_scale: params?.cfg_scale || 0.5,
              sound: params?.sound || null,
              image_mode: params?.image_mode || "normal",
              camera_control: params?.camera_control || null,
              imageUrl: params?.imageUrl || null,
              originalUrl: videoUrl,
              videoId: videoInfo.id,
            },
          },
        });

        let savedVideo: any = {
          id: generatedVideo.id,
          videoUrl: awsS3Url,
          prompt: params?.prompt || "",
          model: params?.model || "kling-v1",
          duration: params?.duration || "5",
          aspectRatio: "auto",
          imageUrl: params?.imageUrl || null,
          createdAt: generatedVideo.createdAt.toISOString(),
          status: "completed" as const,
          metadata: {
            negativePrompt: params?.negative_prompt || "",
            mode: params?.mode || "std",
            cfgScale: params?.cfg_scale || 0.5,
            sound: params?.sound || null,
            cameraControl: params?.camera_control || null,
            imageMode: params?.image_mode || "normal",
            referenceImageUrl: params?.imageUrl || null,
            profileId: vaultProfileId || null,
          },
        };

        // ADDITIONALLY create VaultItem if saving to vault
        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          await prisma.vaultItem.create({
            data: {
              clerkId: vaultFolder.clerkId, // Use folder owner's clerkId for shared profiles
              profileId: vaultProfileId,
              folderId: vaultFolderId,
              fileName: filename,
              fileType: "video/mp4",
              awsS3Key: s3Key,
              awsS3Url: awsS3Url,
              fileSize: videoBuffer.length,
              metadata: {
                source: "kling-i2v",
                generationType: "image-to-video",
                model: params?.model || "kling-v1",
                prompt: params?.prompt || "",
                negativePrompt: params?.negative_prompt || "",
                duration: params?.duration || "5",
                mode: params?.mode || "std",
                cfgScale: params?.cfg_scale || 0.5,
                sound: params?.sound || null,
                imageMode: params?.image_mode || "normal",
                cameraControl: params?.camera_control || null,
                referenceImageUrl: params?.imageUrl || null, // Add reference image URL for vault reuse
                generatedAt: new Date().toISOString(),
                generatedByClerkId: userId, // Track who actually generated it
              },
            },
          });
          savedVideo.savedToVault = true;
        }

        // Track storage usage (non-blocking)
        if (videoBuffer.length > 0 && saveToVault && vaultFolder) {
          trackStorageUpload(vaultFolder.clerkId, videoBuffer.length).catch((error) => {
            console.error('[Kling I2V] Failed to track storage upload:', error);
          });
        }

        // Update GenerationJob status
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: {
            status: "COMPLETED",
            params: {
              ...params,
              taskId,
            },
          },
        });

        console.log("[Kling I2V] Video saved to database:", savedVideo.id);

        return NextResponse.json({
          status: "completed",
          videos: [savedVideo],
          taskId: taskId,
          metadata: {
            model: params?.model,
            duration: params?.duration,
            imageUrl: params?.imageUrl,
          },
        });
      } catch (saveError) {
        console.error("[Kling I2V] Error saving video:", saveError);
        // Return video URL even if save failed
        return NextResponse.json({
          status: "completed",
          videoUrl: videoUrl,
          taskId: taskId,
        });
      }
    }

    // Check if task failed
    if (taskStatus === "failed") {
      const errorMessage = data.data?.task_status_msg || "Video generation failed";
      return NextResponse.json({
        status: "failed",
        error: errorMessage,
        taskId: taskId,
      });
    }

    // Task is still processing
    return NextResponse.json({
      status: "processing",
      taskId: taskId,
      taskStatus: taskStatus,
    });
  } catch (error: any) {
    console.error("[Kling I2V] Error polling task status:", error);
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    );
  }
}
