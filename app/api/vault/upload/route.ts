import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/database";
import { trackStorageUpload } from "@/lib/storageEvents";

// For Next.js App Router runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for large uploads
export const dynamic = 'force-dynamic';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// POST /api/vault/upload - Upload file to S3 and create vault item
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const profileId = formData.get("profileId") as string;
    const folderId = formData.get("folderId") as string;

    if (!file || !profileId || !folderId) {
      return NextResponse.json(
        { error: "file, profileId, and folderId are required" },
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
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${timestamp}-${sanitizedFileName}`;

    // Get user's organization slug
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        currentOrganizationId: true,
        currentOrganization: {
          select: { slug: true }
        }
      },
    });

    // S3 key structure with organization prefix:
    // - With org: organizations/{organizationSlug}/vault/{clerkId}/{profileId}/{folderId}/{fileName}
    // - Without org (fallback): vault/{clerkId}/{profileId}/{folderId}/{fileName}
    const s3Key = user?.currentOrganization?.slug
      ? `organizations/${user.currentOrganization.slug}/vault/${userId}/${profileId}/${folderId}/${uniqueFileName}`
      : `vault/${userId}/${profileId}/${folderId}/${uniqueFileName}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // Generate S3 URL
    const awsS3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Create vault item in database
    const vaultItem = await prisma.vaultItem.create({
      data: {
        clerkId: userId,
        profileId,
        folderId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        awsS3Key: s3Key,
        awsS3Url,
      },
    });

    // Track storage usage for the organization (non-blocking)
    if (file.size && file.size > 0) {
      trackStorageUpload(userId, file.size).catch((error) => {
        console.error('Failed to track storage upload:', error);
      });
    }

    return NextResponse.json(vaultItem);
  } catch (error) {
    console.error("Error uploading to vault:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
