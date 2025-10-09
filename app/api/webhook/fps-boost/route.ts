// app/api/webhook/fps-boost/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, status, progress, videos, stage, message, elapsedTime, error } = body;

    console.log("=== FPS BOOST WEBHOOK ===");
    console.log("Job ID:", jobId);
    console.log("Status:", status);
    console.log("Progress:", progress);

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // Update job in database
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status.toUpperCase();
    }

    if (progress !== undefined) {
      updateData.progress = progress;
    }

    if (stage) {
      updateData.stage = stage;
    }

    if (message) {
      updateData.message = message;
    }

    if (elapsedTime !== undefined) {
      updateData.elapsedTime = elapsedTime;
    }

    if (error) {
      updateData.error = error;
    }

    // Update the job
    const job = await prisma.generationJob.update({
      where: { id: jobId },
      data: updateData,
    });

    console.log("✅ Job updated:", job.id);

    // If completed and videos are provided, save them to database
    if (status === "completed" && videos && Array.isArray(videos)) {
      console.log(`📹 Saving ${videos.length} video(s) to database...`);

      for (const video of videos) {
        try {
          await prisma.generatedVideo.create({
            data: {
              clerkId: job.clerkId,
              jobId: job.id,
              filename: video.filename,
              subfolder: video.subfolder || "fps_boost",
              type: video.type || "output",
              awsS3Key: video.awsS3Key,
              awsS3Url: video.awsS3Url,
              fileSize: video.fileSize,
              format: "mp4",
            },
          });

          console.log(`✅ Video saved: ${video.filename}`);
        } catch (error) {
          console.error(`❌ Error saving video ${video.filename}:`, error);
        }
      }

      console.log("✅ All videos saved to database");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ FPS boost webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
