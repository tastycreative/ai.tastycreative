import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Get the user to check for existing avatar
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { imageUrl: true },
    });

    // Delete old avatar from S3 if it exists and is from our bucket
    if (user?.imageUrl && user.imageUrl.includes(BUCKET_NAME)) {
      try {
        const oldKey = user.imageUrl.split(`${BUCKET_NAME}.s3.`)[1]?.split(".amazonaws.com/")[1];
        if (oldKey) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: oldKey,
            })
          );
        }
      } catch (deleteError) {
        console.error("Error deleting old avatar:", deleteError);
        // Continue with upload even if delete fails
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const s3Key = `avatars/${userId}/${timestamp}.${extension}`;

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
      })
    );

    // Construct the public S3 URL
    const imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${s3Key}`;

    // Update user profile with new image URL
    const updatedUser = await prisma.user.update({
      where: { clerkId: userId },
      data: { imageUrl },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      imageUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { imageUrl: true },
    });

    // Delete avatar from S3 if it exists and is from our bucket
    if (user?.imageUrl && user.imageUrl.includes(BUCKET_NAME)) {
      try {
        const s3Key = user.imageUrl.split(`${BUCKET_NAME}.s3.`)[1]?.split(".amazonaws.com/")[1];
        if (s3Key) {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: s3Key,
            })
          );
        }
      } catch (deleteError) {
        console.error("Error deleting avatar from S3:", deleteError);
      }
    }

    // Update user profile to remove image URL
    const updatedUser = await prisma.user.update({
      where: { clerkId: userId },
      data: { imageUrl: null },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error deleting avatar:", error);
    return NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
  }
}
