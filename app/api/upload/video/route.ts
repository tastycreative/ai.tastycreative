// app/api/upload/video/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const video = formData.get("video") as File;

    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    // Check file size (max 100MB to prevent memory issues)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (video.size > MAX_SIZE) {
      return NextResponse.json(
        { 
          success: false,
          error: `Video too large. Maximum size is 100MB. Your video is ${(video.size / 1024 / 1024).toFixed(2)}MB` 
        },
        { status: 400 }
      );
    }

    console.log("=== VIDEO UPLOAD ===");
    console.log("User ID:", userId);
    console.log("Video:", video.name, video.size, video.type);
    console.log("Size (MB):", (video.size / 1024 / 1024).toFixed(2));

    // Convert video to base64
    const bytes = await video.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Generate a unique filename
    const timestamp = Date.now();
    const originalName = video.name.replace(/\s+/g, "_");
    const filename = `video_${userId}_${timestamp}_${originalName}`;

    console.log("✅ Video processed successfully");
    console.log("Filename:", filename);
    console.log("Base64 size (MB):", (base64.length / 1024 / 1024).toFixed(2));

    return NextResponse.json({
      success: true,
      filename: filename,
      base64: base64,
      size: video.size,
      type: video.type,
    });
  } catch (error) {
    console.error("❌ Video upload error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Upload failed" 
      },
      { status: 500 }
    );
  }
}
