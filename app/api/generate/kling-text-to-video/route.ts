import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import * as jose from "jose";

// Vercel function configuration - extend timeout for video generation
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max (Pro plan)
export const dynamic = "force-dynamic";

// Kling API Configuration
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY!;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY!;
const KLING_API_URL = "https://api.klingai.com/v1/videos/text2video";

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
      negative_prompt,
      model = "kling-v1-6",
      mode = "std",
      duration = "5",
      aspect_ratio = "16:9",
      cfg_scale = 0.5,
      camera_control,
      targetFolder,
      // Vault folder params
      saveToVault,
      vaultProfileId,
      vaultFolderId,
    } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Prepare Kling API request payload
    const payload: any = {
      model_name: model,
      prompt,
      cfg_scale,
      mode,
      duration,
      aspect_ratio,
    };

    // Add negative prompt if provided
    if (negative_prompt) {
      payload.negative_prompt = negative_prompt;
    }

    // Add camera control if provided
    if (camera_control) {
      payload.camera_control = camera_control;
    }

    // Create GenerationJob in database
    const generationJob = await prisma.generationJob.create({
      data: {
        type: "TEXT_TO_VIDEO",
        status: "PROCESSING",
        params: {
          prompt,
          negative_prompt: negative_prompt || null,
          model,
          mode,
          duration,
          aspect_ratio,
          cfg_scale,
          camera_control: camera_control || null,
          source: "kling-t2v",
          targetFolder: targetFolder || null,
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

    console.log("[Kling T2V] Sending request with payload:", JSON.stringify(payload, null, 2));

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
      console.error("[Kling T2V] API error response:", {
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
    console.log("[Kling T2V] API response:", {
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
        prompt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Kling T2V] Generation error:", error);
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
        const videos = await prisma.generatedVideo.findMany({
          where: {
            clerkId: userId,
            job: {
              type: "TEXT_TO_VIDEO",
              params: {
                path: ["source"],
                equals: "kling-t2v",
              },
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

        const formattedVideos = videos.map((video) => ({
          id: video.id,
          videoUrl: video.awsS3Url || video.s3Key,
          prompt: (video.job.params as any)?.prompt || "Unknown prompt",
          model: (video.job.params as any)?.model || "kling-v1",
          duration: (video.job.params as any)?.duration || "5",
          aspectRatio: (video.job.params as any)?.aspect_ratio || "16:9",
          createdAt: video.createdAt.toISOString(),
          status: "completed" as const,
        }));

        return NextResponse.json({ videos: formattedVideos });
      } catch (error) {
        console.error("[Kling T2V] Error fetching video history:", error);
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

    console.log("[Kling T2V] Polling task status:", taskId);

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Kling T2V] Status check error:", errorText);
      return NextResponse.json(
        { error: "Failed to check task status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[Kling T2V] Task status response:", {
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

      console.log("[Kling T2V] Video URL found:", videoUrl);

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
          console.error("[Kling T2V] GenerationJob not found for taskId:", taskId);
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

        // Verify vault folder if saving to vault
        let vaultFolder = null;
        if (saveToVault && vaultProfileId && vaultFolderId) {
          vaultFolder = await prisma.vaultFolder.findFirst({
            where: {
              id: vaultFolderId,
              profileId: vaultProfileId,
              clerkId: userId,
            },
          });
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
        const filename = `kling-t2v-${timestamp}.mp4`;

        // Determine S3 key based on folder selection
        let s3Key: string;
        let subfolder = "";

        if (saveToVault && vaultProfileId && vaultFolderId) {
          // Save to vault folder
          s3Key = `vault/${userId}/${vaultProfileId}/${vaultFolderId}/${filename}`;
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
        console.log("[Kling T2V] Video uploaded to S3:", s3Key);

        const awsS3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");

        // Save to database - either VaultItem or GeneratedVideo
        let savedVideo: any;

        if (saveToVault && vaultProfileId && vaultFolderId) {
          // Create VaultItem for vault storage with generation metadata
          const vaultItem = await prisma.vaultItem.create({
            data: {
              clerkId: userId,
              profileId: vaultProfileId,
              folderId: vaultFolderId,
              fileName: filename,
              fileType: "video/mp4",
              awsS3Key: s3Key,
              awsS3Url: awsS3Url,
              fileSize: videoBuffer.length,
              metadata: {
                source: "kling-t2v",
                generationType: "text-to-video",
                model: params?.model || "kling-v1",
                prompt: params?.prompt || "",
                negativePrompt: params?.negative_prompt || "",
                duration: params?.duration || "5",
                aspectRatio: params?.aspect_ratio || "16:9",
                mode: params?.mode || "std",
                generatedAt: new Date().toISOString(),
              },
            },
          });

          savedVideo = {
            id: vaultItem.id,
            videoUrl: awsS3Url,
            prompt: params?.prompt || "",
            model: params?.model || "kling-v1",
            duration: params?.duration || "5",
            aspectRatio: params?.aspect_ratio || "16:9",
            createdAt: vaultItem.createdAt.toISOString(),
            status: "completed" as const,
            savedToVault: true,
          };
        } else {
          // Create GeneratedVideo for regular storage
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
                source: "kling-t2v",
                prompt: params?.prompt || "",
                negative_prompt: params?.negative_prompt || "",
                model: params?.model || "kling-v1",
                mode: params?.mode || "std",
                duration: params?.duration || "5",
                aspect_ratio: params?.aspect_ratio || "16:9",
                cfg_scale: params?.cfg_scale || 0.5,
                camera_control: params?.camera_control || null,
                originalUrl: videoUrl,
                videoId: videoInfo.id,
              },
            },
          });

          savedVideo = {
            id: generatedVideo.id,
            videoUrl: awsS3Url,
            prompt: params?.prompt || "",
            model: params?.model || "kling-v1",
            duration: params?.duration || "5",
            aspectRatio: params?.aspect_ratio || "16:9",
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

        console.log("[Kling T2V] Video saved to database:", savedVideo.id);

        return NextResponse.json({
          status: "completed",
          videos: [savedVideo],
          taskId: taskId,
          metadata: {
            model: params?.model,
            duration: params?.duration,
            aspectRatio: params?.aspect_ratio,
          },
        });
      } catch (saveError) {
        console.error("[Kling T2V] Error saving video:", saveError);
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
    console.error("[Kling T2V] Error polling task status:", error);
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    );
  }
}
