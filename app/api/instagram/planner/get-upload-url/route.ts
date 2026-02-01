// app/api/instagram/planner/get-upload-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/database";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tastycreative-media";

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
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profileId, plannerType, files } = await request.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Files array required" },
        { status: 400 }
      );
    }

    if (!plannerType || !['story', 'reel', 'feed-post'].includes(plannerType)) {
      return NextResponse.json(
        { error: "Valid plannerType required (story, reel, feed-post)" },
        { status: 400 }
      );
    }

    // Determine the target userId for the S3 path
    let targetUserId = userId;
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Unauthorized to upload to this profile" },
          { status: 403 }
        );
      }
      // Use the profile owner's userId for consistent S3 path structure
      targetUserId = profile.clerkId;
    }

    // Map plannerType to folder structure
    const folderMap: Record<string, string> = {
      'story': 'instagram/stories',
      'reel': 'instagram/reels',
      'feed-post': 'instagram/feed-posts',
    };
    const folder = folderMap[plannerType];

    // Generate presigned URLs for each file
    const uploadUrls = await Promise.all(
      files.map(async (file: { name: string; type: string; size: number }) => {
        const fileId = uuidv4();
        const extension = file.name.split(".").pop() || "";
        const key = `${folder}/${targetUserId}/${fileId}.${extension}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          ContentType: file.type,
          Metadata: {
            originalName: encodeURIComponent(file.name),
            plannerType: plannerType,
            userId: targetUserId,
          },
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
          expiresIn: 3600, // 1 hour
        });

        // The final URL after upload
        const finalUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;

        return {
          fileId,
          uploadUrl,
          finalUrl,
          key,
          originalName: file.name,
          type: file.type,
          size: file.size,
        };
      })
    );

    return NextResponse.json({ uploadUrls });
  } catch (error) {
    console.error("Error generating upload URLs:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URLs" },
      { status: 500 }
    );
  }
}
