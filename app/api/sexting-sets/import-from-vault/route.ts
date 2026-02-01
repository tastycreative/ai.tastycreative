import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, CopyObjectCommand } from "@aws-sdk/client-s3";

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
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

// POST - Import vault items to a sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { setId, vaultItemIds } = body;

    if (!setId) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    if (!vaultItemIds || !Array.isArray(vaultItemIds) || vaultItemIds.length === 0) {
      return NextResponse.json(
        { error: "Vault item IDs are required" },
        { status: 400 }
      );
    }

    // Find the sexting set
    const sextingSet = await prisma.sextingSet.findFirst({
      where: { id: setId },
      include: {
        images: {
          orderBy: { sequence: "desc" },
          take: 1,
        },
      },
    });

    if (!sextingSet) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    // Verify access via the set's category (profileId)
    const { hasAccess } = await hasAccessToProfile(userId, sextingSet.category);

    // Also allow if user owns the set directly
    if (!hasAccess && sextingSet.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to modify this set" },
        { status: 403 }
      );
    }

    // Get starting sequence number (after existing images)
    const startSequence = (sextingSet.images[0]?.sequence || 0) + 1;

    // Fetch all vault items (vault items belong to current user)
    const vaultItems = await prisma.vaultItem.findMany({
      where: {
        id: { in: vaultItemIds },
        clerkId: userId,
      },
    });

    if (vaultItems.length === 0) {
      return NextResponse.json(
        { error: "No valid vault items found" },
        { status: 404 }
      );
    }

    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_REGION!;

    // Create sexting images for each vault item
    const createdImages = [];
    for (let i = 0; i < vaultItems.length; i++) {
      const vaultItem = vaultItems[i];
      const sequence = startSequence + i;

      // Generate new S3 key in sexting set folder structure
      const fileExtension = vaultItem.fileName.split('.').pop() || '';
      const baseName = vaultItem.fileName.replace(/\.[^/.]+$/, '');
      const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const newFileName = `${Date.now()}_${sanitizedBaseName}.${fileExtension}`;
      const newS3Key = `${sextingSet.s3FolderPath}/${newFileName}`;

      // Extract original S3 key from URL
      const originalS3Key = vaultItem.awsS3Url?.includes('.amazonaws.com/')
        ? decodeURIComponent(vaultItem.awsS3Url.split('.amazonaws.com/')[1])
        : vaultItem.awsS3Key;

      let newS3Url = vaultItem.awsS3Url || ''; // Fallback to original URL if copy fails

      // Copy file to new sexting set location in S3
      if (originalS3Key) {
        try {
          await s3Client.send(
            new CopyObjectCommand({
              Bucket: bucket,
              CopySource: `${bucket}/${originalS3Key}`,
              Key: newS3Key,
            })
          );

          // Generate new S3 URL
          newS3Url = `https://${bucket}.s3.${region}.amazonaws.com/${newS3Key}`;
        } catch (copyError) {
          console.error(`Error copying file ${vaultItem.fileName}:`, copyError);
          // Continue with original URL as fallback
        }
      }

      const sextingImage = await prisma.sextingImage.create({
        data: {
          setId: sextingSet.id,
          url: newS3Url,
          name: vaultItem.fileName,
          type: vaultItem.fileType,
          sequence,
          size: vaultItem.fileSize,
        },
      });

      createdImages.push(sextingImage);
    }

    // Fetch updated set with all images
    const updatedSet = await prisma.sextingSet.findUnique({
      where: { id: setId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Imported ${createdImages.length} items from vault`,
      itemCount: createdImages.length,
      set: updatedSet,
    });
  } catch (error) {
    console.error("Error importing from vault:", error);
    return NextResponse.json(
      { error: "Failed to import from vault" },
      { status: 500 }
    );
  }
}
