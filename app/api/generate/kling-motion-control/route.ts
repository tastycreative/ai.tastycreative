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

    // Parse form data
    const formData = await request.formData();
    
    const image = formData.get("image") as File;
    const video = formData.get("video") as File;
    const prompt = formData.get("prompt") as string | null;
    const mode = (formData.get("mode") as string) || "std";
    const characterOrientation = (formData.get("character_orientation") as string) || "image";
    const keepOriginalSound = (formData.get("keep_original_sound") as string) || "no";
    const targetFolder = formData.get("targetFolder") as string | null;
    const saveToVault = formData.get("saveToVault") === "true";
    const vaultProfileId = formData.get("vaultProfileId") as string | null;
    const vaultFolderId = formData.get("vaultFolderId") as string | null;

    // Validate required fields
    if (!image) {
      return NextResponse.json({ error: "Reference image is required" }, { status: 400 });
    }
    if (!video) {
      return NextResponse.json({ error: "Reference video is required" }, { status: 400 });
    }

    // Validate character orientation
    if (!["image", "video"].includes(characterOrientation)) {
      return NextResponse.json({ error: "Character orientation must be 'image' or 'video'" }, { status: 400 });
    }

    // Validate mode
    if (!["std", "pro"].includes(mode)) {
      return NextResponse.json({ error: "Mode must be 'std' or 'pro'" }, { status: 400 });
    }

    // Convert image to buffer and upload to S3
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageFilename = `kling-motion-image-${Date.now()}.jpg`;
    const imageUrl = await uploadToS3(imageBuffer, imageFilename, userId, "image/jpeg");

    console.log("[Kling Motion Control] Image uploaded to:", imageUrl);

    // Convert video to buffer and upload to S3
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    const videoFilename = `kling-motion-video-${Date.now()}.mp4`;
    const videoUrl = await uploadToS3(videoBuffer, videoFilename, userId, "video/mp4");

    console.log("[Kling Motion Control] Reference video uploaded to:", videoUrl);

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

    const data = await response.json();
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
        const videos = await prisma.generatedVideo.findMany({
          where: {
            clerkId: userId,
            job: {
              type: "IMAGE_TO_VIDEO",
              params: {
                path: ["source"],
                equals: "kling-motion-control",
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
          prompt: (video.job.params as any)?.prompt || "",
          mode: (video.job.params as any)?.mode || "std",
          characterOrientation: (video.job.params as any)?.character_orientation || "image",
          imageUrl: (video.job.params as any)?.imageUrl || null,
          referenceVideoUrl: (video.job.params as any)?.referenceVideoUrl || null,
          createdAt: video.createdAt.toISOString(),
          status: "completed" as const,
        }));

        return NextResponse.json({ videos: formattedVideos });
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
        { error: "Failed to check task status" },
        { status: response.status }
      );
    }

    const data = await response.json();
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

        if (saveToVault && vaultProfileId && vaultFolderId) {
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
        console.log("[Kling Motion Control] Video uploaded to S3:", s3Key);

        const awsS3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`.replace(/%2F/g, "/");

        // Save to database
        let savedVideo: any;

        if (saveToVault && vaultProfileId && vaultFolderId) {
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
            },
          });

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
