import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CopyObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "tastycreative";

/**
 * Move a file from one S3 folder to another
 * This is a copy + delete operation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sourceKey, destinationFolder, keepOriginal = false } = await request.json();

    if (!sourceKey || !destinationFolder) {
      return NextResponse.json(
        { error: "Missing required fields: sourceKey, destinationFolder" },
        { status: 400 }
      );
    }

    // Extract filename from source key
    const sourceFilename = sourceKey.split('/').pop() || 'unknown';
    
    // Build destination key
    const trimmedFolder = destinationFolder.replace(/^\/+/, "").replace(/\/+$/, "");
    const timestamp = Date.now();
    const destinationKey = `${trimmedFolder}/${userId}/${timestamp}_${sourceFilename}`;

    console.log("🔄 Moving S3 object", {
      sourceKey,
      destinationKey,
      userId,
      keepOriginal
    });

    // Step 1: Copy the object to the new location
    const copyCommand = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${sourceKey}`,
      Key: destinationKey,
      MetadataDirective: "COPY",
    });

    await s3Client.send(copyCommand);
    console.log("✅ Object copied successfully");

    // Step 2: Delete the original object (unless keepOriginal is true)
    if (!keepOriginal) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: sourceKey,
      });

      await s3Client.send(deleteCommand);
      console.log("🗑️ Original object deleted");
    }

    const url = `https://${BUCKET_NAME}.s3.amazonaws.com/${destinationKey}`;

    return NextResponse.json({
      success: true,
      sourceKey,
      destinationKey,
      url,
      message: keepOriginal ? "File copied successfully" : "File moved successfully"
    });
  } catch (error) {
    console.error("❌ S3 move error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to move object on S3" },
      { status: 500 }
    );
  }
}
