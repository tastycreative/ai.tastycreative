import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { hasAccessToProfile } from "@/lib/vault-permissions";

// POST /api/vault/trash/folders/restore - Restore a folder and its items from trash
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderId } = body;

    if (!folderId) {
      return NextResponse.json(
        { error: "folderId is required" },
        { status: 400 }
      );
    }

    // Find the folder
    const folder = await prisma.vaultFolder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        profileId: true,
        clerkId: true,
        deletedAt: true,
        parentId: true,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (!folder.deletedAt) {
      return NextResponse.json({ success: true, message: "Folder is not in trash" });
    }

    // Check permission
    const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this folder" },
        { status: 403 }
      );
    }

    // Check if parent folder still exists (if it had one)
    let newParentId = folder.parentId;
    if (newParentId) {
      const parentFolder = await prisma.vaultFolder.findFirst({
        where: { id: newParentId, deletedAt: null },
      });
      if (!parentFolder) {
        newParentId = null; // Move to root if parent is gone
      }
    }

    // Restore the folder
    await prisma.vaultFolder.update({
      where: { id: folderId },
      data: {
        deletedAt: null,
        parentId: newParentId,
      },
    });

    // Restore all items that were in this folder (that still reference it)
    await prisma.vaultItem.updateMany({
      where: {
        folderId: folderId,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
        deletedFromFolderId: null,
      },
    });

    // Also restore any subfolders that were deleted at the same time
    // Find subfolders that were deleted (they would have the same or similar deletedAt)
    const subfoldersToRestore = await prisma.vaultFolder.findMany({
      where: {
        parentId: folderId,
        deletedAt: { not: null },
      },
      select: { id: true },
    });

    if (subfoldersToRestore.length > 0) {
      const subfolderIds = subfoldersToRestore.map((f) => f.id);

      // Restore subfolders
      await prisma.vaultFolder.updateMany({
        where: { id: { in: subfolderIds } },
        data: { deletedAt: null },
      });

      // Restore items in subfolders
      await prisma.vaultItem.updateMany({
        where: {
          folderId: { in: subfolderIds },
          deletedAt: { not: null },
        },
        data: {
          deletedAt: null,
          deletedFromFolderId: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      restoredFolders: 1 + subfoldersToRestore.length,
    });
  } catch (error) {
    console.error("Error restoring folder from trash:", error);
    return NextResponse.json(
      { error: "Failed to restore folder" },
      { status: 500 }
    );
  }
}
