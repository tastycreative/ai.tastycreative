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

// POST /api/vault/folders/bulk-move-to-profile - Move multiple folders to another profile
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderIds, targetProfileId, targetParentFolderId } = body as {
      folderIds: string[];
      targetProfileId: string;
      targetParentFolderId: string | null;
    };

    if (!Array.isArray(folderIds) || folderIds.length === 0) {
      return NextResponse.json(
        { error: "folderIds array is required" },
        { status: 400 }
      );
    }

    if (!targetProfileId) {
      return NextResponse.json(
        { error: "targetProfileId is required" },
        { status: 400 }
      );
    }

    // Verify user has access to the target profile
    const { hasAccess: hasTargetAccess, profile: targetProfile } =
      await hasAccessToProfile(userId, targetProfileId);
    if (!hasTargetAccess || !targetProfile) {
      return NextResponse.json(
        { error: "Access denied to target profile" },
        { status: 403 }
      );
    }

    const targetOwnerClerkId =
      targetProfile.clerkId || targetProfile.user?.clerkId || userId;

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

    const results: { folderId: string; success: boolean; error?: string }[] = [];

    for (const folderId of folderIds) {
      try {
        const folder = await prisma.vaultFolder.findUnique({
          where: { id: folderId, deletedAt: null },
          select: {
            id: true,
            isDefault: true,
            profileId: true,
            clerkId: true,
          },
        });

        if (!folder) {
          results.push({ folderId, success: false, error: "Folder not found" });
          continue;
        }

        if (folder.isDefault) {
          results.push({ folderId, success: false, error: "Cannot move default folder" });
          continue;
        }

        // Already in the target profile — skip
        if (folder.profileId === targetProfileId) {
          results.push({ folderId, success: false, error: "Folder already in target profile" });
          continue;
        }

        // Check access to the source profile
        const { hasAccess: hasSourceAccess } = await hasAccessToProfile(
          userId,
          folder.profileId
        );
        if (!hasSourceAccess) {
          results.push({ folderId, success: false, error: "Access denied to source folder" });
          continue;
        }

        // Get all descendant folder IDs
        const descendantIds = await getDescendantFolderIds(folderId);
        const allFolderIds = [folderId, ...descendantIds];

        // Move everything in a transaction
        await prisma.$transaction(async (tx) => {
          // Update the source folder
          await tx.vaultFolder.update({
            where: { id: folderId },
            data: {
              profileId: targetProfileId,
              clerkId: targetOwnerClerkId,
              parentId: targetParentFolderId || null,
            },
          });

          // Update all descendant folders
          if (descendantIds.length > 0) {
            await tx.vaultFolder.updateMany({
              where: { id: { in: descendantIds } },
              data: {
                profileId: targetProfileId,
                clerkId: targetOwnerClerkId,
              },
            });
          }

          // Update all items in all affected folders
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

        results.push({ folderId, success: true });
      } catch (err) {
        console.error(`Error moving folder ${folderId} to profile:`, err);
        results.push({ folderId, success: false, error: "Unexpected error" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({ results, successCount, failCount });
  } catch (error) {
    console.error("Error bulk-moving folders to profile:", error);
    return NextResponse.json(
      { error: "Failed to bulk move folders to profile" },
      { status: 500 }
    );
  }
}
