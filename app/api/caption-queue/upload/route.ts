import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative";

const ALLOWED_FILE_TYPES = {
  image: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("fileType") as string; // 'image' or 'video'

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!fileType || !['image', 'video'].includes(fileType)) {
      return NextResponse.json({ error: "Valid file type is required (image or video)" }, { status: 400 });
    }

    // Validate file MIME type
    const allowedTypes = ALLOWED_FILE_TYPES[fileType as keyof typeof ALLOWED_FILE_TYPES];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          error: `Invalid ${fileType} type. Allowed types: ${allowedTypes.join(", ")}` 
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is 500MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` 
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split(".").pop()?.toLowerCase() || (fileType === 'image' ? 'jpg' : 'mp4');
    const s3Key = `caption-queue/${userId}/${timestamp}-${randomString}.${extension}`;

    console.log(`Uploading ${fileType} to S3:`, {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      mimeType: file.type,
      s3Key,
    });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "max-age=31536000", // Cache for 1 year
        Metadata: {
          userId,
          originalFileName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      })
    );

    // Construct the public S3 URL
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${s3Key}`;

    console.log("Upload successful:", fileUrl);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      fileType,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to upload file" 
      },
      { status: 500 }
    );
  }
}
