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

// POST - Export a sexting set to a new vault folder
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { setId, profileId, folderName } = body;

    if (!setId) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    if (!folderName) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Find the sexting set
    const sextingSet = await prisma.sextingSet.findFirst({
      where: { id: setId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
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
        { error: "Unauthorized to export this set" },
        { status: 403 }
      );
    }

    if (sextingSet.images.length === 0) {
      return NextResponse.json(
        { error: "Set has no images to export" },
        { status: 400 }
      );
    }

    // Verify access to the target profile for vault export
    const { hasAccess: hasTargetProfileAccess, profile } = await hasAccessToProfile(userId, profileId);

    if (!hasTargetProfileAccess) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Create new vault folder for this export (owned by current user)
    const vaultFolder = await prisma.vaultFolder.create({
      data: {
        clerkId: userId,
        name: folderName,
        profileId: profileId,
        isDefault: false,
      },
    });

    // Sort images by sequence to ensure correct order
    const sortedImages = [...sextingSet.images].sort((a, b) => a.sequence - b.sequence);
    
    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_REGION!;
    
    // Create vault items for each image in the sexting set (in sequence order)
    const createdItems = [];
    for (let i = 0; i < sortedImages.length; i++) {
      const image = sortedImages[i];
      const orderIndex = i + 1; // 1-based index based on sorted order
      
      // Create filename with proper ordering prefix
      const fileExtension = image.name.split('.').pop() || '';
      const baseName = image.name.replace(/\.[^/.]+$/, '');
      const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const orderedFileName = `${orderIndex.toString().padStart(3, '0')}_${sanitizedBaseName}.${fileExtension}`;
      
      // Generate NEW S3 key in vault folder structure
      const newS3Key = `vault/${userId}/${profileId}/${vaultFolder.id}/${Date.now()}_${orderedFileName}`;
      
      // Extract original S3 key from URL
      const originalS3Key = image.url.includes('.amazonaws.com/') 
        ? decodeURIComponent(image.url.split('.amazonaws.com/')[1])
        : null;
      
      let newS3Url = image.url; // Fallback to original URL if copy fails
      
      // Copy file to new vault location in S3
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
          console.error(`Error copying file ${image.name} to vault:`, copyError);
          // Continue with original URL as fallback
        }
      }

      const vaultItem = await prisma.vaultItem.create({
        data: {
          clerkId: userId,
          fileName: orderedFileName,
          fileType: image.type,
          fileSize: image.size,
          awsS3Key: newS3Key,
          awsS3Url: newS3Url,
          folderId: vaultFolder.id,
          profileId: profileId,
          metadata: {
            source: "sexting-set-export",
            originalSetId: sextingSet.id,
            originalSetName: sextingSet.name,
            sequence: orderIndex, // Use the sorted order index
            originalSequence: image.sequence,
            originalFileName: image.name,
            exportedAt: new Date().toISOString(),
          },
        },
      });

      createdItems.push(vaultItem);
    }

    return NextResponse.json({
      success: true,
      message: `Exported ${createdItems.length} items to vault`,
      folderId: vaultFolder.id,
      folderName: vaultFolder.name,
      itemCount: createdItems.length,
    });
  } catch (error) {
    console.error("Error exporting to vault:", error);
    return NextResponse.json(
      { error: "Failed to export to vault" },
      { status: 500 }
    );
  }
}
