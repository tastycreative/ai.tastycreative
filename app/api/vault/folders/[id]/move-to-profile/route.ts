import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { hasAccessToProfile } from "@/lib/vault-permissions";

// Helper: get all descendant folder IDs recursively
async function getDescendantFolderIds(folderId: string): Promise<string[]> {
  const descendants: string[] = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.vaultFolder.findMany({
      where: { parentId: currentId, deletedAt: null },
      select: { id: true },
    });
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }

  return descendants;
}

// POST /api/vault/folders/[id]/move-to-profile - Move folder + contents to another profile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: folderId } = await params;
    const body = await request.json();
    const { targetProfileId, targetParentFolderId } = body;

    if (!targetProfileId) {
      return NextResponse.json(
        { error: "targetProfileId is required" },
        { status: 400 }
      );
    }

    // Get the source folder
    const folder = await prisma.vaultFolder.findUnique({
      where: { id: folderId, deletedAt: null },
      select: {
        id: true,
        name: true,
        isDefault: true,
        profileId: true,
        clerkId: true,
        parentId: true,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Cannot move default folders
    if (folder.isDefault) {
      return NextResponse.json(
        { error: "Cannot move default folder" },
        { status: 400 }
      );
    }

    // Check user has access to source profile
    const { hasAccess: hasSourceAccess } = await hasAccessToProfile(
      userId,
      folder.profileId
    );
    if (!hasSourceAccess) {
      return NextResponse.json(
        { error: "Access denied to source folder" },
        { status: 403 }
      );
    }

    // Check user has access to target profile
    const { hasAccess: hasTargetAccess, profile: targetProfile } =
      await hasAccessToProfile(userId, targetProfileId);
    if (!hasTargetAccess || !targetProfile) {
      return NextResponse.json(
        { error: "Access denied to target profile" },
        { status: 403 }
      );
    }

    // If same profile, redirect to use the normal PATCH move
    if (folder.profileId === targetProfileId) {
      return NextResponse.json(
        { error: "Source and target profiles are the same. Use the regular move endpoint." },
        { status: 400 }
      );
    }

    // Validate target parent folder if provided
    if (targetParentFolderId) {
      const targetParent = await prisma.vaultFolder.findUnique({
        where: { id: targetParentFolderId, deletedAt: null },
        select: { id: true, profileId: true, isDefault: true },
      });

      if (!targetParent) {
        return NextResponse.json(
          { error: "Target parent folder not found" },
          { status: 404 }
        );
      }

      if (targetParent.profileId !== targetProfileId) {
        return NextResponse.json(
          { error: "Target parent folder does not belong to the target profile" },
          { status: 400 }
        );
      }

      if (targetParent.isDefault) {
        return NextResponse.json(
          { error: "Cannot move into a default folder" },
          { status: 400 }
        );
      }
    }

    // Get all descendant folder IDs
    const descendantIds = await getDescendantFolderIds(folderId);
    const allFolderIds = [folderId, ...descendantIds];

    // Determine the target profile owner's clerkId
    const targetOwnerClerkId =
      targetProfile.clerkId || targetProfile.user?.clerkId || userId;

    // Use a transaction to move everything atomically
    await prisma.$transaction(async (tx) => {
      // Update the source folder: change profileId, clerkId, parentId, clear organizationSlug
      await tx.vaultFolder.update({
        where: { id: folderId },
        data: {
          profileId: targetProfileId,
          clerkId: targetOwnerClerkId,
          parentId: targetParentFolderId || null,
        },
      });

      // Update all descendant folders: change profileId and clerkId
      if (descendantIds.length > 0) {
        await tx.vaultFolder.updateMany({
          where: { id: { in: descendantIds } },
          data: {
            profileId: targetProfileId,
            clerkId: targetOwnerClerkId,
          },
        });
      }

      // Update all items in all affected folders: change profileId and clerkId
      await tx.vaultItem.updateMany({
        where: {
          folderId: { in: allFolderIds },
          deletedAt: null,
        },
        data: {
          profileId: targetProfileId,
          clerkId: targetOwnerClerkId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      folderId,
      targetProfileId,
      movedFolders: allFolderIds.length,
    });
  } catch (error) {
    console.error("Error moving folder to profile:", error);
    return NextResponse.json(
      { error: "Failed to move folder to profile" },
      { status: 500 }
    );
  }
}
