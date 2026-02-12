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

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Check if it's a shared organization profile
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        organizationId: user.currentOrganizationId,
      },
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

// POST /api/vault/presigned-url - Get presigned URL for direct S3 upload
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, fileSize, profileId, folderId, organizationSlug } = await request.json();

    if (!fileName || !fileType || !profileId || !folderId) {
      return NextResponse.json(
        { error: "fileName, fileType, profileId, and folderId are required" },
        { status: 400 }
      );
    }

    // Check if user has access to this profile
    const { hasAccess } = await hasAccessToProfile(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this profile" },
        { status: 403 }
      );
    }

    // Verify the folder exists and belongs to this profile
    const folder = await prisma.vaultFolder.findFirst({
      where: {
        id: folderId,
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

    // Get user's organization slug
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        currentOrganizationId: true,
      },
    });

    // S3 key structure with organization prefix:
    // - With org: organizations/{organizationSlug}/vault/{clerkId}/{profileId}/{folderId}/{fileName}
    // - Without org (fallback): vault/{clerkId}/{profileId}/{folderId}/{fileName}
    const s3Key = organizationSlug
      ? `organizations/${organizationSlug}/vault/${userId}/${profileId}/${folderId}/${uniqueFileName}`
      : `vault/${userId}/${profileId}/${folderId}/${uniqueFileName}`;

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
