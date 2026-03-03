import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { Prisma } from "@/lib/generated/prisma";
import { hasAccessToProfile } from "@/lib/vault-permissions";

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

// PATCH /api/vault/folders/[id] - Update folder name and/or parent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, parentId } = body;

    console.log("[PATCH Vault Folder] Updating folder:", id, "by user:", userId, "with data:", { name, parentId });

    // At least one field must be provided
    if (!name && parentId === undefined) {
      return NextResponse.json({ error: "name or parentId is required" }, { status: 400 });
    }

    // Get the folder to check permissions
    const folder = await prisma.vaultFolder.findUnique({
      where: { id },
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
      console.log("[PATCH Vault Folder] Folder not found:", id);
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    console.log("[PATCH Vault Folder] Found folder:", { 
      id: folder.id, 
      name: folder.name, 
      profileId: folder.profileId, 
      clerkId: folder.clerkId,
      isDefault: folder.isDefault 
    });

    // Prevent modifying default folder
    if (folder.isDefault && (name || parentId !== undefined)) {
      // Allow moving default folder's parentId but not renaming
      if (name) {
        console.log("[PATCH Vault Folder] Attempted to rename default folder");
        return NextResponse.json(
          { error: "Cannot rename default folder" },
          { status: 400 }
        );
      }
    }

    // Check if user has access to the profile this folder belongs to
    const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
    
    console.log("[PATCH Vault Folder] Access check result:", { 
      userId, 
      profileId: folder.profileId, 
      hasAccess 
    });
    
    if (!hasAccess) {
      console.log("[PATCH Vault Folder] Access denied - user does not have access to profile");
      return NextResponse.json(
        { error: "Access denied to this folder. You must be the owner or a member of the profile's organization." },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: { name?: string; parentId?: string | null } = {};
    
    if (name) {
      updateData.name = name;
    }

    // Handle parentId change (move folder)
    if (parentId !== undefined) {
      // parentId = null means move to root
      if (parentId === null) {
        updateData.parentId = null;
      } else {
        // Cannot move folder into itself
        if (parentId === id) {
          return NextResponse.json(
            { error: "Cannot move a folder into itself" },
            { status: 400 }
          );
        }

        // Verify destination folder exists and belongs to a profile the user can access
        const destinationFolder = await prisma.vaultFolder.findUnique({
          where: { id: parentId },
          select: { id: true, profileId: true },
        });

        if (!destinationFolder) {
          return NextResponse.json(
            { error: "Destination folder not found" },
            { status: 404 }
          );
        }

        const { hasAccess: hasDestAccess } = await hasAccessToProfile(userId, destinationFolder.profileId);
        if (!hasDestAccess) {
          return NextResponse.json(
            { error: "Access denied to destination folder" },
            { status: 403 }
          );
        }

        // Prevent circular moves: destination cannot be a descendant of source
        const descendants = await getDescendantFolderIds(id);
        if (descendants.has(parentId)) {
          return NextResponse.json(
            { error: "Cannot move a folder into one of its own subfolders" },
            { status: 400 }
          );
        }

        updateData.parentId = parentId;
      }
    }

    const updatedFolder = await prisma.vaultFolder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("Error updating vault folder:", error);
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}

// DELETE /api/vault/folders/[id] - Delete folder and all items
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    console.log("[DELETE Vault Folder] Attempting to delete folder:", id, "by user:", userId);

    // Get the folder to check permissions
    const folder = await prisma.vaultFolder.findUnique({
      where: { id },
      select: { 
        id: true, 
        isDefault: true, 
        profileId: true, 
        clerkId: true 
      },
    });

    if (!folder) {
      console.log("[DELETE Vault Folder] Folder not found:", id);
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    console.log("[DELETE Vault Folder] Found folder:", { 
      id: folder.id, 
      profileId: folder.profileId, 
      clerkId: folder.clerkId, 
      isDefault: folder.isDefault 
    });

    // Prevent deleting default folder
    if (folder.isDefault) {
      console.log("[DELETE Vault Folder] Attempted to delete default folder");
      return NextResponse.json(
        { error: "Cannot delete default folder" },
        { status: 400 }
      );
    }

    // Check if user has access to the profile this folder belongs to
    const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
    
    console.log("[DELETE Vault Folder] Access check result:", { 
      userId, 
      profileId: folder.profileId, 
      hasAccess 
    });
    
    if (!hasAccess) {
      console.log("[DELETE Vault Folder] Access denied - user does not have access to profile");
      return NextResponse.json(
        { error: "Access denied to this folder. You must be the owner or a member of the profile's organization." },
        { status: 403 }
      );
    }

    // Soft-delete: move folder and all its contents to trash
    const descendantIds = await getDescendantFolderIds(id);
    const allFolderIds = [id, ...Array.from(descendantIds)];
    const now = new Date();

    // Soft-delete all items in these folders (set deletedFromFolderId = current folderId)
    await prisma.$executeRaw`
      UPDATE vault_items
      SET "deletedAt" = ${now}, "deletedFromFolderId" = "folderId", "updatedAt" = ${now}
      WHERE "folderId" IN (${Prisma.join(allFolderIds)})
      AND "deletedAt" IS NULL
    `;

    // Soft-delete all folders
    await prisma.vaultFolder.updateMany({
      where: { id: { in: allFolderIds } },
      data: { deletedAt: now },
    });

    console.log("[DELETE Vault Folder] Soft-deleted folder and contents:", { folderId: id, totalFolders: allFolderIds.length });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vault folder:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
