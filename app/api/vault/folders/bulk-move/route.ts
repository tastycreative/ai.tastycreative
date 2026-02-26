import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { hasAccessToProfileSimple } from "@/lib/vault-permissions";

// Helper: get all descendant folder IDs to prevent circular moves
async function getDescendantFolderIds(folderId: string): Promise<Set<string>> {
  const descendants = new Set<string>();
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.vaultFolder.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

// POST /api/vault/folders/bulk-move - Move multiple folders to a new parent
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderIds, destinationParentId } = body as {
      folderIds: string[];
      destinationParentId: string | null;
    };

    if (!Array.isArray(folderIds) || folderIds.length === 0) {
      return NextResponse.json({ error: "folderIds array is required" }, { status: 400 });
    }

    // Validate destination folder if not root
    if (destinationParentId !== null) {
      const destFolder = await prisma.vaultFolder.findUnique({
        where: { id: destinationParentId },
        select: { id: true, profileId: true },
      });

      if (!destFolder) {
        return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
      }

      const hasDestAccess = await hasAccessToProfileSimple(userId, destFolder.profileId);
      if (!hasDestAccess) {
        return NextResponse.json({ error: "Access denied to destination folder" }, { status: 403 });
      }
    }

    const results: { folderId: string; success: boolean; error?: string }[] = [];

    for (const folderId of folderIds) {
      try {
        // Cannot move into itself
        if (folderId === destinationParentId) {
          results.push({ folderId, success: false, error: "Cannot move folder into itself" });
          continue;
        }

        const folder = await prisma.vaultFolder.findUnique({
          where: { id: folderId },
          select: { id: true, isDefault: true, profileId: true, parentId: true },
        });

        if (!folder) {
          results.push({ folderId, success: false, error: "Folder not found" });
          continue;
        }

        if (folder.isDefault) {
          results.push({ folderId, success: false, error: "Cannot move default folder" });
          continue;
        }

        const hasAccess = await hasAccessToProfileSimple(userId, folder.profileId);
        if (!hasAccess) {
          results.push({ folderId, success: false, error: "Access denied" });
          continue;
        }

        // Skip if already at the destination
        if (folder.parentId === destinationParentId) {
          results.push({ folderId, success: true }); // already there
          continue;
        }

        // Prevent circular moves
        if (destinationParentId !== null) {
          const descendants = await getDescendantFolderIds(folderId);
          if (descendants.has(destinationParentId)) {
            results.push({ folderId, success: false, error: "Cannot move folder into its own subfolder" });
            continue;
          }
        }

        await prisma.vaultFolder.update({
          where: { id: folderId },
          data: { parentId: destinationParentId },
        });

        results.push({ folderId, success: true });
      } catch (err) {
        results.push({ folderId, success: false, error: "Unexpected error" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({ results, successCount, failCount });
  } catch (error) {
    console.error("Error bulk-moving vault folders:", error);
    return NextResponse.json({ error: "Failed to bulk move folders" }, { status: 500 });
  }
}
