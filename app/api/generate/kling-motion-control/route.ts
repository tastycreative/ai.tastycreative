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
const KLING_API_URL = "https://api.klingai.com/v1/videos/motion-control";

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

// Upload file to S3 and return URL
async function uploadToS3(buffer: Buffer, filename: string, userId: string, contentType: string): Promise<string> {
  const s3Key = `temp/${userId}/${filename}`;
  
  const uploadCommand = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(uploadCommand);
  
  const fileUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");
  return fileUrl;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse JSON body (changed from FormData to JSON to accept S3 URLs)
    const body = await request.json();
    
    const imageUrl = body.imageUrl as string;
    const videoUrl = body.videoUrl as string;
    const prompt = body.prompt as string | null;
    const mode = body.mode || "std";
    const characterOrientation = body.character_orientation || "image";
    const keepOriginalSound = body.keep_original_sound || "no";
    const targetFolder = body.targetFolder as string | null;
    const saveToVault = body.saveToVault === true || body.saveToVault === "true";
    const vaultProfileId = body.vaultProfileId as string | null;
    const vaultFolderId = body.vaultFolderId as string | null;
    const organizationSlug = body.organizationSlug as string | null;

    // Validate required fields (now expecting S3 URLs)
    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }
    if (!videoUrl) {
      return NextResponse.json({ error: "Video URL is required" }, { status: 400 });
    }

    // Validate URLs are valid S3 URLs
    if (!imageUrl.includes('s3.') && !imageUrl.includes('amazonaws.com')) {
      return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
    }
    if (!videoUrl.includes('s3.') && !videoUrl.includes('amazonaws.com')) {
      return NextResponse.json({ error: "Invalid video URL format" }, { status: 400 });
    }

    // Validate character orientation
    if (!["image", "video"].includes(characterOrientation)) {
      return NextResponse.json({ error: "Character orientation must be 'image' or 'video'" }, { status: 400 });
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
    const featureKey = 'kling_motion_control';

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

    // Validate mode
    if (!["std", "pro"].includes(mode)) {
      return NextResponse.json({ error: "Mode must be 'std' or 'pro'" }, { status: 400 });
    }

    // Files are already uploaded to S3 by the client
    // We just use the provided URLs directly
    console.log("[Kling Motion Control] Using pre-uploaded image:", imageUrl);
    console.log("[Kling Motion Control] Using pre-uploaded video:", videoUrl);

    // Prepare Kling API request payload
    const payload: any = {
      image_url: imageUrl,
      video_url: videoUrl,
      character_orientation: characterOrientation,
      mode,
      keep_original_sound: keepOriginalSound,
    };

    // Add prompt if provided
    if (prompt && prompt.trim()) {
      payload.prompt = prompt.trim();
    }

    // Create GenerationJob in database
    const generationJob = await prisma.generationJob.create({
      data: {
        type: "IMAGE_TO_VIDEO",
        status: "PROCESSING",
        params: {
          prompt: prompt || "",
          mode,
          character_orientation: characterOrientation,
          keep_original_sound: keepOriginalSound,
          source: "kling-motion-control",
          imageUrl: imageUrl,
          referenceVideoUrl: videoUrl,
          targetFolder: targetFolder || null,
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

    console.log("[Kling Motion Control] Sending request with payload:", JSON.stringify(payload, null, 2));

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
      console.error("[Kling Motion Control] API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return NextResponse.json(
        {
          error: errorData.message || errorData.error || "Motion control video generation task creation failed",
          details: errorData,
        },
        { status: response.status }
      );
    }

    // Safely parse successful response
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[Kling Motion Control] Failed to parse API response:", responseText.substring(0, 500));
      return NextResponse.json(
        {
          error: "Received invalid response from Kling API. Please try again.",
          details: { rawResponse: responseText.substring(0, 200) },
        },
        { status: 502 }
      );
    }
    
    console.log("[Kling Motion Control] API response:", {
      code: data.code,
      message: data.message,
      taskId: data.data?.task_id,
    });

    // Check for API-level errors
    if (data.code !== 0) {
      return NextResponse.json(
        {
          error: data.message || "Motion control video generation task creation failed",
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
        mode,
        prompt: prompt || "",
        imageUrl,
        referenceVideoUrl: videoUrl,
        characterOrientation,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Kling Motion Control] Generation error:", error);
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
        const filterProfileId = searchParams.get("profileId");
        const isAllProfiles = filterProfileId === "all";
        console.log("[Kling Motion Control] Fetching video history for user:", userId, "profileId:", filterProfileId, "isAllProfiles:", isAllProfiles);

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

        // Filter to only Kling Motion Control jobs
        const klingJobIds = recentJobs
          .filter((job) => {
            const params = job.params as any;
            if (params?.source !== "kling-motion-control") return false;
            
            // Filter by profileId if specified (and not "all")
            if (filterProfileId && !isAllProfiles) {
              return params?.vaultProfileId === filterProfileId;
            }
            return true;
          })
          .map((job) => job.id);

        console.log("[Kling Motion Control] Found Kling job IDs:", klingJobIds.length);

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

        console.log("[Kling Motion Control] Found generated videos:", videos.length);

        // Step 3: Also fetch vault items that were created from Kling Motion Control
        // Need to check both: items where clerkId matches (own profile) OR items generated by this user (shared profile)
        const vaultQuery: any = {
          fileType: {
            startsWith: "video/",
          },
          OR: [
            { clerkId: userId }, // Items on own profiles
          ],
        };
        
        // Filter by profileId if specified (and not "all")
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

        // Filter to only Kling Motion Control generated videos
        // Also include items where this user generated on a shared profile
        const vaultVideos = allVaultVideos
          .filter((vid) => {
            const metadata = vid.metadata as any;
            const isKlingMotionControl = metadata?.source === "kling-motion-control";
            if (!isKlingMotionControl) return false;
            
            // Include if: user owns the item OR user generated the item (on shared profile)
            const isOwned = vid.clerkId === userId;
            const isGenerated = metadata?.generatedByClerkId === userId;
            return isOwned || isGenerated;
          })
          .slice(0, 20);

        console.log("[Kling Motion Control] Found vault videos:", vaultVideos.length);

        // Map generated videos
        const mappedGeneratedVideos = videos.map((video) => {
          const params = video.job.params as any;
          const videoProfileId = params?.vaultProfileId || null;
          return {
            id: video.id,
            videoUrl: video.awsS3Url || video.s3Key || "",
            prompt: params?.prompt || "",
            mode: params?.mode || "std",
            characterOrientation: params?.character_orientation || "image",
            imageUrl: params?.imageUrl || null,
            referenceVideoUrl: params?.referenceVideoUrl || null,
            createdAt: video.createdAt.toISOString(),
            status: "completed" as const,
            source: "generated" as const,
            profileName: isAllProfiles && videoProfileId ? profileMap[videoProfileId] || null : null,
            metadata: {
              prompt: params?.prompt || "",
              mode: params?.mode || "std",
              character_orientation: params?.character_orientation || "image",
              keep_original_sound: params?.keep_original_sound || "no",
              imageUrl: params?.imageUrl || null,
              referenceVideoUrl: params?.referenceVideoUrl || null,
              profileId: videoProfileId,
            },
          };
        });

        // Map vault videos
        const mappedVaultVideos = vaultVideos.map((vid) => {
          const metadata = vid.metadata as any;
          return {
            id: vid.id,
            videoUrl: vid.awsS3Url || "",
            prompt: metadata?.prompt || "",
            mode: metadata?.mode || "std",
            characterOrientation: metadata?.character_orientation || "image",
            imageUrl: metadata?.imageUrl || null,
            referenceVideoUrl: metadata?.referenceVideoUrl || null,
            createdAt: vid.createdAt.toISOString(),
            status: "completed" as const,
            source: "vault" as const,
            profileName: isAllProfiles && vid.profileId ? profileMap[vid.profileId] || null : null,
            metadata: {
              prompt: metadata?.prompt || "",
              mode: metadata?.mode || "std",
              character_orientation: metadata?.character_orientation || "image",
              keep_original_sound: metadata?.keep_original_sound || "no",
              imageUrl: metadata?.imageUrl || null,
              referenceVideoUrl: metadata?.referenceVideoUrl || null,
              profileId: metadata?.profileId || null,
            },
          };
        });

        // Combine and sort by date
        const allVideos = [...mappedGeneratedVideos, ...mappedVaultVideos]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 20);

        console.log("[Kling Motion Control] Returning total videos:", allVideos.length);

        return NextResponse.json({ videos: allVideos });
      } catch (error) {
        console.error("[Kling Motion Control] Error fetching video history:", error);
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

    console.log("[Kling Motion Control] Polling task status:", taskId);

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Kling Motion Control] Status check error:", errorText);
      return NextResponse.json(
        { error: "Failed to check task status", status: "failed" },
        { status: response.status }
      );
    }

    // Safely parse successful response
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[Kling Motion Control] Failed to parse status response:", responseText.substring(0, 500));
      return NextResponse.json(
        {
          error: "Received invalid response while checking status. Please try again.",
          status: "failed",
        },
        { status: 502 }
      );
    }
    
    console.log("[Kling Motion Control] Task status response:", {
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
      const videoDuration = videoInfo.duration;

      console.log("[Kling Motion Control] Video URL found:", videoUrl);

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
          console.error("[Kling Motion Control] GenerationJob not found for taskId:", taskId);
          return NextResponse.json({
            status: "completed",
            videos: [{
              id: taskId,
              videoUrl: videoUrl,
              duration: videoDuration,
              createdAt: new Date().toISOString(),
              status: "completed",
            }],
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

            console.log('[Kling Motion Control] Access check:', {
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
                console.log('[Kling Motion Control] Using organization shared vault folder:', vaultFolder.name);
              }
            }
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
        const filename = `kling-motion-control-${timestamp}.mp4`;

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
        console.log("[Kling Motion Control] Video uploaded to S3:", s3Key);

        const awsS3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");

        // Save to database
        let savedVideo: any;

        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          const vaultItem = await prisma.vaultItem.create({
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
                source: "kling-motion-control",
                profileId: vaultProfileId,
                prompt: params?.prompt || "",
                mode: params?.mode || "std",
                character_orientation: params?.character_orientation || "image",
                keep_original_sound: params?.keep_original_sound || "no",
                imageUrl: params?.imageUrl || null,
                referenceVideoUrl: params?.referenceVideoUrl || null,
                originalUrl: videoUrl,
                videoId: videoInfo.id,
                duration: videoDuration,
                generatedByClerkId: userId, // Track who actually generated it
              },
            },
          });

          // Track storage usage (non-blocking)
          if (videoBuffer.length > 0) {
            trackStorageUpload(vaultFolder.clerkId, videoBuffer.length).catch((error) => {
              console.error('[Kling Motion Control] Failed to track storage upload:', error);
            });
          }

          savedVideo = {
            id: vaultItem.id,
            videoUrl: awsS3Url,
            prompt: params?.prompt || "",
            mode: params?.mode || "std",
            characterOrientation: params?.character_orientation || "image",
            duration: videoDuration,
            imageUrl: params?.imageUrl || null,
            referenceVideoUrl: params?.referenceVideoUrl || null,
            createdAt: vaultItem.createdAt.toISOString(),
            status: "completed" as const,
            savedToVault: true,
          };
        } else {
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
              duration: parseFloat(videoDuration || "0"),
              format: "mp4",
              metadata: {
                source: "kling-motion-control",
                profileId: params?.vaultProfileId || null,
                prompt: params?.prompt || "",
                mode: params?.mode || "std",
                character_orientation: params?.character_orientation || "image",
                keep_original_sound: params?.keep_original_sound || "no",
                imageUrl: params?.imageUrl || null,
                referenceVideoUrl: params?.referenceVideoUrl || null,
                originalUrl: videoUrl,
                videoId: videoInfo.id,
              },
            },
          });

          savedVideo = {
            id: generatedVideo.id,
            videoUrl: awsS3Url,
            prompt: params?.prompt || "",
            mode: params?.mode || "std",
            characterOrientation: params?.character_orientation || "image",
            duration: videoDuration,
            imageUrl: params?.imageUrl || null,
            referenceVideoUrl: params?.referenceVideoUrl || null,
            createdAt: generatedVideo.createdAt.toISOString(),
            status: "completed" as const,
          };
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

        console.log("[Kling Motion Control] Video saved to database:", savedVideo.id);

        return NextResponse.json({
          status: "completed",
          videos: [savedVideo],
          taskId: taskId,
          metadata: {
            mode: params?.mode,
            characterOrientation: params?.character_orientation,
            imageUrl: params?.imageUrl,
            referenceVideoUrl: params?.referenceVideoUrl,
          },
        });
      } catch (saveError) {
        console.error("[Kling Motion Control] Error saving video:", saveError);
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
    console.error("[Kling Motion Control] Error polling task status:", error);
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    );
  }
}
