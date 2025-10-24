import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId, itemType, destinationFolder } = await request.json();

    if (!itemId || !itemType || !destinationFolder) {
      return NextResponse.json(
        { error: "Missing required fields: itemId, itemType, destinationFolder" },
        { status: 400 }
      );
    }

    const normalizedType = String(itemType).toUpperCase();

    if (normalizedType !== "IMAGE" && normalizedType !== "VIDEO") {
      return NextResponse.json(
        { error: "itemType must be IMAGE or VIDEO" },
        { status: 400 }
      );
    }

    const record =
      normalizedType === "IMAGE"
        ? await prisma.generatedImage.findUnique({
            where: { id: itemId },
            select: {
              clerkId: true,
              filename: true,
              awsS3Key: true,
              fileSize: true,
              format: true,
            },
          })
        : await prisma.generatedVideo.findUnique({
            where: { id: itemId },
            select: {
              clerkId: true,
              filename: true,
              awsS3Key: true,
              fileSize: true,
              format: true,
            },
          });

    if (!record) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (record.clerkId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!record.awsS3Key) {
      return NextResponse.json(
        { error: "Source asset is not stored on AWS S3" },
        { status: 400 }
      );
    }

    const sanitizedFilename = record.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const trimmedFolder = destinationFolder.replace(/^\/+/, "").replace(/\/+$/, "");
    const timestamp = Date.now();
    
    // For Instagram staging folders, don't use userId subfolder (flat structure for easy browsing)
    // For outputs folder, use userId subfolder (organized by user)
    const isInstagramFolder = trimmedFolder.startsWith('instagram/');
    const destinationKey = isInstagramFolder
      ? `${trimmedFolder}/${timestamp}_${sanitizedFilename}`  // instagram/posts/timestamp_filename.png
      : `${trimmedFolder}/${userId}/${timestamp}_${sanitizedFilename}`; // outputs/userId/timestamp_filename.png

    console.log("📦 Copying object on S3", {
      sourceKey: record.awsS3Key,
      destinationKey,
    });

    const copyCommand = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${record.awsS3Key}`,
      Key: destinationKey,
      // Note: ACL removed - bucket uses bucket policy for public access instead
      MetadataDirective: "COPY",
    });

    await s3Client.send(copyCommand);

    const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${destinationKey}`;

    const mimeType = record.format
      ? `${normalizedType === "VIDEO" ? "video" : "image"}/${record.format.toLowerCase()}`
      : "application/octet-stream";
    const isVideo = normalizedType === "VIDEO";
    const isImage = !isVideo;

    return NextResponse.json({
      success: true,
      file: {
        id: destinationKey,
        name: sanitizedFilename,
        key: destinationKey,
        url,
        size: record.fileSize ?? 0,
        mimeType,
        lastModified: new Date().toISOString(),
        isImage,
        isVideo,
      },
    });
  } catch (error) {
    console.error("❌ S3 copy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to copy object on S3" },
      { status: 500 }
    );
  }
}
