import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

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

    // Verify ownership of the sexting set
    const sextingSet = await prisma.sextingSet.findFirst({
      where: { id: setId, userId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!sextingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    if (sextingSet.images.length === 0) {
      return NextResponse.json(
        { error: "Set has no images to export" },
        { status: 400 }
      );
    }

    // Verify the profile belongs to this user
    const profile = await prisma.instagramProfile.findFirst({
      where: { id: profileId, clerkId: userId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    // Create new vault folder for this export
    const vaultFolder = await prisma.vaultFolder.create({
      data: {
        clerkId: userId,
        name: folderName,
        profileId: profileId,
        isDefault: false,
      },
    });

    // Create vault items for each image in the sexting set
    const createdItems = [];
    for (const image of sextingSet.images) {
      // Extract S3 key from URL or generate one
      const s3Key = image.url.includes('.amazonaws.com/') 
        ? image.url.split('.amazonaws.com/')[1]
        : `vault/${userId}/${profileId}/${vaultFolder.id}/${Date.now()}_${image.sequence}_${image.name}`;

      const vaultItem = await prisma.vaultItem.create({
        data: {
          clerkId: userId,
          fileName: `${image.sequence.toString().padStart(3, '0')}_${image.name}`,
          fileType: image.type,
          fileSize: image.size,
          awsS3Key: s3Key,
          awsS3Url: image.url,
          folderId: vaultFolder.id,
          profileId: profileId,
          metadata: {
            source: "sexting-set-export",
            originalSetId: sextingSet.id,
            originalSetName: sextingSet.name,
            sequence: image.sequence,
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
