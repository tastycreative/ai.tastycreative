import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/database";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// POST /api/vault/presigned-url - Get presigned URL for direct S3 upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, fileSize, profileId, folderId } = await request.json();

    if (!fileName || !fileType || !profileId || !folderId) {
      return NextResponse.json(
        { error: "fileName, fileType, profileId, and folderId are required" },
        { status: 400 }
      );
    }

    // Verify folder ownership
    const folder = await prisma.vaultFolder.findFirst({
      where: {
        id: folderId,
        clerkId: userId,
        profileId,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found or access denied" },
        { status: 404 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;

    // S3 key structure: vault/{clerkId}/{profileId}/{folderId}/{fileName}
    const s3Key = `vault/${userId}/${profileId}/${folderId}/${uniqueFileName}`;

    // Generate presigned URL for direct upload (valid for 10 minutes)
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    // Generate the final S3 URL
    const awsS3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    return NextResponse.json({
      presignedUrl,
      s3Key,
      awsS3Url,
      fileName,
      fileType,
      fileSize,
      profileId,
      folderId,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
