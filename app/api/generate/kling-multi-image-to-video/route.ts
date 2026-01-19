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
    const model = (formData.get("model") as string) || "kling-v1-6";
    const mode = (formData.get("mode") as string) || "std";
    const duration = (formData.get("duration") as string) || "5";
    const cfg_scale = parseFloat((formData.get("cfg_scale") as string) || "0.5");
    const targetFolder = formData.get("targetFolder") as string | null;
    const saveToVault = formData.get("saveToVault") === "true";
    const vaultProfileId = formData.get("vaultProfileId") as string | null;
    const vaultFolderId = formData.get("vaultFolderId") as string | null;

    // Validate required fields (at least 2 images required)
    if (images.length < 2) {
      return NextResponse.json({ error: "At least 2 images are required" }, { status: 400 });
    }

    if (images.length > 5) {
      return NextResponse.json({ error: "Maximum 5 images allowed" }, { status: 400 });
    }

    // Upload all images to S3 and get URLs
    const imageList: Array<{ url: string; index?: number }> = [];
    for (let i = 0; i < images.length; i++) {
      const imageBuffer = Buffer.from(await images[i].arrayBuffer());
      const imageFilename = `kling-multi-i2v-source-${Date.now()}-${i + 1}.jpg`;
      const imageUrl = await uploadImageToS3(imageBuffer, imageFilename, userId);
      // Format: array of objects with url property
      imageList.push({ url: imageUrl });
      console.log(`[Kling Multi-I2V] Image ${i + 1} uploaded to:`, imageUrl);
    }

    // Prepare Kling API request payload according to Kling API spec
    // The multi-image2video endpoint expects 'image_list' as an array of objects
    const payload: Record<string, unknown> = {
      model_name: model,
      image_list: imageList,
      mode: mode,
      duration: duration,
      cfg_scale: cfg_scale,
    };

    // Add optional parameters
    if (prompt) payload.prompt = prompt;
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
          image_count: images.length,
          targetFolder,
          saveToVault,
          vaultProfileId,
          vaultFolderId,
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

    // If requesting history
    if (history === "true") {
      console.log("[Kling Multi-I2V] Fetching video history for user:", userId);

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

      // Filter to only Kling Multi-I2V jobs
      const klingJobIds = recentJobs
        .filter((job) => {
          const params = job.params as any;
          return params?.source === "kling-multi-i2v";
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
      const allVaultVideos = await prisma.vaultItem.findMany({
        where: {
          clerkId: userId,
          fileType: {
            startsWith: "video/",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      });

      // Filter to only Kling Multi-I2V generated videos
      const vaultVideos = allVaultVideos
        .filter((vid) => {
          const metadata = vid.metadata as any;
          return metadata?.source === "kling-multi-i2v";
        })
        .slice(0, 20);

      console.log("[Kling Multi-I2V] Found vault videos:", vaultVideos.length);

      // Map generated videos from jobs
      const mappedGeneratedVideos = jobs
        .filter(job => job.videos.length > 0)
        .map(job => ({
          id: job.id,
          videoUrl: job.videos[0]?.awsS3Url || job.videos[0]?.networkVolumePath || "",
          prompt: (job.params as { prompt?: string })?.prompt || "",
          model: (job.params as { model?: string })?.model || "kling-v1-6",
          duration: (job.params as { duration?: string })?.duration || "5",
          imageCount: (job.params as { image_count?: number })?.image_count || 0,
          createdAt: job.createdAt.toISOString(),
          status: "completed" as const,
          source: "generated" as const,
        }));

      // Map vault videos
      const mappedVaultVideos = vaultVideos.map((vid) => {
        const metadata = vid.metadata as any;
        return {
          id: vid.id,
          videoUrl: vid.awsS3Url || "",
          prompt: metadata?.prompt || "",
          model: metadata?.model || "kling-v1-6",
          duration: metadata?.duration || "5",
          imageCount: metadata?.image_count || 0,
          createdAt: vid.createdAt.toISOString(),
          status: "completed" as const,
          source: "vault" as const,
        };
      });

      // Combine and sort by date
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
          
          const targetFolder = (job.params as { targetFolder?: string })?.targetFolder;
          const s3VideoUrl = await uploadVideoToS3(videoBuffer, videoFilename, userId, targetFolder || undefined);

          // Create GeneratedVideo record
          const video = await prisma.generatedVideo.create({
            data: {
              clerkId: userId,
              jobId: job.id,
              filename: videoFilename,
              awsS3Url: s3VideoUrl,
              awsS3Key: s3VideoUrl.split(".com/")[1],
              metadata: {
                prompt: (job.params as { prompt?: string })?.prompt,
                model: (job.params as { model?: string })?.model,
                duration: (job.params as { duration?: string })?.duration,
                image_count: (job.params as { image_count?: number })?.image_count,
              },
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
