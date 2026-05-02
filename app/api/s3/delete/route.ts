import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/clerk-compat";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID! || process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! || process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || "tastycreative";

/**
 * Delete a file from S3
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await request.json();

    if (!key) {
      return NextResponse.json(
        { error: "Missing required field: key" },
        { status: 400 }
      );
    }

    console.log("🗑️ Deleting S3 object", {
      key,
      userId,
      bucket: BUCKET_NAME
    });

    // Delete the object
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(deleteCommand);
    console.log("✅ Object deleted successfully");

    return NextResponse.json({
      success: true,
      key,
      message: "File deleted successfully"
    });
  } catch (error) {
    console.error("❌ Error deleting S3 object:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to delete object from S3",
        details: error
      },
      { status: 500 }
    );
  }
}
