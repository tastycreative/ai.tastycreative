import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";

// Vercel function configuration - extend timeout for video generation
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max (Pro plan)
export const dynamic = 'force-dynamic';

const BYTEPLUSES_API_KEY = process.env.ARK_API_KEY!;
const BYTEPLUSES_API_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks";

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
      image,
      model = "ep-20260105171451-cljlk",
      resolution,
      ratio,
      duration,
      seed,
      cameraFixed,
      watermark,
      generateAudio,
      targetFolder,
      referenceImageUrl, // The actual reference image URL for history/reuse
      // Vault folder params
      saveToVault,
      vaultProfileId,
      vaultFolderId,
    } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    // Build content array for image-to-video
    const content = [
      {
        type: "text",
        text: prompt,
      },
      {
        type: "image_url",
        image_url: {
          url: image,
        },
      },
    ];

    // Prepare BytePlus API request payload
    const payload: any = {
      model,
      content,
    };

    // Add parameters at root level (not in options object)
    if (resolution) payload.resolution = resolution;
    if (ratio) payload.ratio = ratio;
    if (duration !== undefined) payload.duration = duration;
    if (seed !== undefined && seed !== -1) payload.seed = seed;
    if (cameraFixed !== undefined) payload.camerafixed = cameraFixed;
    if (watermark !== undefined) payload.watermark = watermark;

    // Add generate_audio as top-level parameter
    if (generateAudio !== undefined) {
      payload.generate_audio = generateAudio;
    }

    // Create GenerationJob in database
    const generationJob = await prisma.generationJob.create({
      data: {
        type: "IMAGE_TO_VIDEO",
        status: "PROCESSING",
        params: {
          prompt,
          model,
          resolution,
          ratio,
          duration,
          seed,
          cameraFixed,
          watermark,
          generateAudio,
          source: "seedream-i2v",
          targetFolder: targetFolder || null,
          referenceImageUrl: referenceImageUrl || null, // Store reference image for history/reuse
          // Vault params
          saveToVault: saveToVault || false,
          vaultProfileId: vaultProfileId || null,
          vaultFolderId: vaultFolderId || null,
        },
        user: {
          connect: {
            clerkId: userId,
          },
        },
      },
    });

    console.log("[DEBUG] Duration value received:", duration);
    console.log("[DEBUG] Generate Audio value:", generateAudio);
    console.log("[DEBUG] Payload keys:", Object.keys(payload));
    console.log("Sending Image-to-Video request to BytePlus API with payload:", JSON.stringify(payload, null, 2));

    // Call BytePlus API to create task
    const response = await fetch(BYTEPLUSES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BYTEPLUSES_API_KEY}`,
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
      console.error("BytePlus API error response:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        fullResponse: errorText
      });
      return NextResponse.json(
        { 
          error: errorData.message || errorData.error || "Video generation task creation failed",
          details: errorData 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("BytePlus API response:", {
      taskId: data.id,
      status: data.status,
    });

    // Update GenerationJob with BytePlus taskId
    await prisma.generationJob.update({
      where: { id: generationJob.id },
      data: {
        params: {
          ...(generationJob.params as object),
          taskId: data.id,
        },
      },
    });

    // Return task ID for polling
    return NextResponse.json({
      success: true,
      taskId: data.id,
      status: data.status,
      jobId: generationJob.id,
      metadata: {
        model,
        prompt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Image-to-Video generation error:", error);
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
        const isAllProfiles = profileId === 'all';
        
        console.log('📋 Fetching SeeDream I2V history for user:', userId, 'profileId:', profileId);
        
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
        
        const videos = await prisma.generatedVideo.findMany({
          where: {
            clerkId: userId,
            job: {
              type: "IMAGE_TO_VIDEO",
              params: {
                path: ["source"],
                equals: "seedream-i2v",
              },
            },
          },
          include: {
            job: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        });

        // Filter by profileId if provided (not for all profiles)
        let filteredVideos = videos;
        if (profileId && !isAllProfiles) {
          filteredVideos = videos.filter((video) => {
            const params = video.job.params as any;
            // Include if profileId matches OR if no profileId was set (backward compatibility)
            return params?.vaultProfileId === profileId || !params?.vaultProfileId;
          });
        }

        const formattedVideos = filteredVideos.map((video) => {
          const metadata = video.metadata as any;
          const params = video.job.params as any;
          const videoProfileId = params?.vaultProfileId;
          return {
            id: video.id,
            videoUrl: video.awsS3Url || video.s3Key,
            prompt: params?.prompt || "Unknown prompt",
            modelVersion: "SeeDream 4.5",
            duration: metadata?.duration || video.duration || 5,
            cameraFixed: metadata?.cameraFixed || params?.cameraFixed || false,
            createdAt: video.createdAt.toISOString(),
            status: "completed" as const,
            // Include profile name when viewing all profiles
            profileName: isAllProfiles && videoProfileId ? profileMap[videoProfileId]?.name || null : null,
            // Include reference image and full metadata for potential reuse
            referenceImageUrl: params?.referenceImageUrl || null,
            metadata: {
              resolution: metadata?.resolution || params?.resolution || "720p",
              ratio: metadata?.ratio || params?.ratio || "16:9",
              generateAudio: params?.generateAudio ?? true,
              cameraFixed: metadata?.cameraFixed || params?.cameraFixed || false,
              referenceImageUrl: params?.referenceImageUrl || null,
              profileId: videoProfileId || null,
            },
          };
        });

        return NextResponse.json({ videos: formattedVideos });
      } catch (error) {
        console.error("Error fetching video history:", error);
        return NextResponse.json({ videos: [] });
      }
    }

    // Handle task polling
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Query task status from BytePlus API
    const statusUrl = `${BYTEPLUSES_API_URL}/${taskId}`;
    
    console.log("Polling task status:", taskId);

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BYTEPLUSES_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("BytePlus status check error:", errorText);
      return NextResponse.json(
        { error: "Failed to check task status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Task status response:", {
      taskId: data.id,
      status: data.status,
      hasVideo: !!data.content?.video_url,
    });

    // Check if task is completed (status is "succeeded")
    if (data.status === "succeeded" && data.content && data.content.video_url) {
      console.log("Video URL found:", data.content.video_url);
      
      try {
        // Find the GenerationJob for this task
        const generationJob = await prisma.generationJob.findFirst({
          where: {
            clerkId: userId,
            type: "IMAGE_TO_VIDEO",
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (!generationJob) {
          console.error("GenerationJob not found for taskId:", taskId);
          return NextResponse.json({
            status: "completed",
            videoUrl: data.content.video_url,
            taskId: data.id,
          });
        }

        const params = generationJob.params as any;
        const targetFolder = params?.targetFolder;
        const saveToVault = params?.saveToVault;
        const vaultProfileId = params?.vaultProfileId;
        const vaultFolderId = params?.vaultFolderId;

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

          // If not owned, check if folder is shared with user OR if profile is shared via organization
          if (!vaultFolder) {
            // Get the user's internal ID for organization membership checks
            const currentUser = await prisma.user.findUnique({
              where: { clerkId: userId },
              select: { id: true, currentOrganizationId: true },
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

            console.log('🔍 I2V Access check:', {
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
                console.log('📂 Using organization shared vault folder:', vaultFolder.name);
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
            return NextResponse.json(
              { error: "Vault folder not found or access denied" },
              { status: 404 }
            );
          }
        }

        // Download video from BytePlus
        const videoResponse = await fetch(data.content.video_url);
        if (!videoResponse.ok) {
          throw new Error("Failed to download video from BytePlus");
        }
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        // Generate filename
        const timestamp = Date.now();
        const filename = `seedream-i2v-${timestamp}.mp4`;

        // Determine S3 key based on folder selection
        let s3Key: string;
        let subfolder = '';
        
        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          // Save to vault folder - use folder owner's clerkId
          s3Key = `vault/${vaultFolder.clerkId}/${vaultProfileId}/${vaultFolderId}/${filename}`;
        } else if (targetFolder) {
          s3Key = `${targetFolder.replace(/\/$/, '')}/${filename}`;
          const parts = targetFolder.split('/');
          if (parts.length > 2) {
            subfolder = parts.slice(2).join('/').replace(/\/$/, '');
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
        console.log("Video uploaded to S3:", s3Key);

        const awsS3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, '/');

        // ALWAYS create GeneratedVideo for history tracking
        const savedVideo = await prisma.generatedVideo.create({
          data: {
            clerkId: userId,
            jobId: generationJob.id,
            filename: filename,
            subfolder: subfolder || "",
            type: "output",
            s3Key: s3Key,
            awsS3Key: s3Key,
            awsS3Url: awsS3Url,
            duration: data.duration,
            fps: data.framespersecond,
            format: "mp4",
            metadata: {
              source: "seedream-i2v",
              prompt: params?.prompt || "",
              resolution: params?.resolution || data.resolution,
              ratio: params?.ratio || data.ratio,
              seed: data.seed,
              cameraFixed: params?.cameraFixed,
              generateAudio: params?.generateAudio,
              watermark: params?.watermark,
              referenceImageUrl: params?.referenceImageUrl || null,
              originalUrl: data.content.video_url,
            },
          },
        });

        let formattedVideo: any = {
          id: savedVideo.id,
          videoUrl: awsS3Url,
          prompt: params?.prompt || "Unknown prompt",
          modelVersion: "SeeDream 4.5",
          duration: data.duration || 5,
          cameraFixed: params?.cameraFixed || false,
          createdAt: savedVideo.createdAt.toISOString(),
          status: "completed" as const,
          referenceImageUrl: params?.referenceImageUrl || null,
          metadata: {
            resolution: params?.resolution || data.resolution || "720p",
            ratio: params?.ratio || data.ratio || "16:9",
            generateAudio: params?.generateAudio ?? true,
            cameraFixed: params?.cameraFixed || false,
            referenceImageUrl: params?.referenceImageUrl || null,
            profileId: vaultProfileId || null,
          },
        };
        
        // ADDITIONALLY create VaultItem if saving to vault
        if (saveToVault && vaultProfileId && vaultFolderId && vaultFolder) {
          await prisma.vaultItem.create({
            data: {
              clerkId: vaultFolder.clerkId, // Use folder owner's clerkId, not current user
              profileId: vaultProfileId,
              folderId: vaultFolderId,
              fileName: filename,
              fileType: "video/mp4",
              awsS3Key: s3Key,
              awsS3Url: awsS3Url,
              fileSize: videoBuffer.length,
              metadata: {
                source: "seedream-i2v",
                generationType: "image-to-video",
                model: "SeeDream 4.5",
                prompt: params?.prompt || "Unknown prompt",
                resolution: params?.resolution || data.resolution,
                ratio: params?.ratio || data.ratio,
                duration: data.duration || 5,
                fps: data.framespersecond,
                seed: data.seed,
                cameraFixed: params?.cameraFixed,
                generateAudio: params?.generateAudio,
                referenceImageUrl: params?.referenceImageUrl || null,
                generatedAt: new Date().toISOString(),
                generatedByClerkId: userId, // Track who actually generated it
              },
            },
          });
          formattedVideo.savedToVault = true;
        }

        // Update GenerationJob status
        await prisma.generationJob.update({
          where: { id: generationJob.id },
          data: { 
            status: "COMPLETED",
          },
        });

        return NextResponse.json({
          status: "completed",
          videoUrl: awsS3Url,
          taskId: data.id,
          videos: [formattedVideo],
          metadata: {
            resolution: data.resolution,
            ratio: data.ratio,
            duration: data.duration,
            seed: data.seed,
            fps: data.framespersecond,
          },
        });
      } catch (error: any) {
        console.error("Error saving video to S3/database:", error);
        // Return the video URL even if save fails
        return NextResponse.json({
          status: "completed",
          videoUrl: data.content.video_url,
          taskId: data.id,
          error: "Failed to save video to storage",
        });
      }
    }

    // Check if task failed
    if (data.status === "failed") {
      return NextResponse.json({
        status: "failed",
        error: data.error_message || "Video generation failed",
        taskId: data.id,
      });
    }

    // Task is still processing
    return NextResponse.json({
      status: "processing",
      taskId: data.id,
    });
  } catch (error: any) {
    console.error("Error polling task status:", error);
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    );
  }
}
