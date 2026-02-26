import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { trackStorageDelete } from "@/lib/storageEvents";
import { hasAccessToProfileSimple } from "@/lib/vault-permissions";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// PATCH /api/vault/items/[id] - Update item (e.g., move to different folder)
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
    const { folderId } = body;

    if (!folderId) {
      return NextResponse.json({ error: "folderId is required" }, { status: 400 });
    }

    // First, find the item (without ownership check)
    const item = await prisma.vaultItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if user is the owner OR has access to the profile via organization sharing OR has EDIT permission on the folder
    const isOwner = item.clerkId === userId;
    
    // Check if user has access to the profile (their own or via organization)
    const hasProfileAccess = await hasAccessToProfileSimple(userId, item.profileId);
    
    if (!isOwner && !hasProfileAccess) {
      // Check if user has EDIT permission on the folder via sharing
      const sharePermission = await prisma.vaultFolderShare.findUnique({
        where: {
          vaultFolderId_sharedWithClerkId: {
            vaultFolderId: item.folderId,
            sharedWithClerkId: userId,
          },
        },
      });

      if (!sharePermission || sharePermission.permission !== 'EDIT') {
        return NextResponse.json(
          { error: "You don't have permission to move this item" },
          { status: 403 }
        );
      }
    }

    // Find the destination folder
    const folder = await prisma.vaultFolder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
    }

    // Determine folder ownership relationships
    const isDestinationOwnFolder = folder.clerkId === userId;
    const isDestinationOriginalOwnerFolder = folder.clerkId === item.clerkId;
    
    // Check if user has access to the destination folder's profile via organization
    const hasDestinationProfileAccess = await hasAccessToProfileSimple(userId, folder.profileId);

    // Check if user has EDIT permission on destination folder (if not owner and no profile access)
    let hasEditOnDestination = isDestinationOwnFolder || hasDestinationProfileAccess;
    if (!isDestinationOwnFolder && !hasDestinationProfileAccess) {
      const destSharePermission = await prisma.vaultFolderShare.findUnique({
        where: {
          vaultFolderId_sharedWithClerkId: {
            vaultFolderId: folderId,
            sharedWithClerkId: userId,
          },
        },
      });
      hasEditOnDestination = destSharePermission?.permission === 'EDIT';
    }

    // Validate the move operation based on permissions
    // If user has profile access (via organization), they can move items freely within that profile
    if (!isOwner && !hasProfileAccess) {
      // User with EDIT permission on source can:
      // 1. Move to their own folder (transfer ownership to self)
      // 2. Move to another folder they have EDIT access to
      // 3. Move within original owner's folders
      if (!isDestinationOwnFolder && !isDestinationOriginalOwnerFolder && !hasEditOnDestination) {
        return NextResponse.json(
          { error: "You need EDIT permission on the destination folder" },
          { status: 403 }
        );
      }
    } else {
      // Owner can:
      // 1. Move to their own folders (any profile)
      // 2. Move to shared folders they have EDIT access to
      const isDestinationOwnedByUser = folder.clerkId === userId;
      if (!isDestinationOwnedByUser && !hasEditOnDestination) {
        return NextResponse.json(
          { error: "You need EDIT permission on the destination folder" },
          { status: 403 }
        );
      }
    }

    // Prepare update data
    const updateData: { folderId: string; clerkId?: string; profileId?: string } = { folderId };

    // Always update profileId to match the destination folder's profile
    // This handles both cross-profile moves within same user and cross-user moves
    if (folder.profileId !== item.profileId) {
      updateData.profileId = folder.profileId;
    }

    // Update ownership when moving to a folder owned by someone else
    if (folder.clerkId !== item.clerkId) {
      updateData.clerkId = folder.clerkId;
    }

    // Update the item
    const updatedItem = await prisma.vaultItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedItem);
  } catch (error: any) {
    console.error("Error updating vault item:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      {
        error: "Failed to update item",
        details: error.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

// DELETE /api/vault/items/[id] - Delete item and S3 file
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
    console.log("[DELETE Vault Item] Attempting to delete item:", id, "by user:", userId);

    // First, find the item (without ownership check)
    const item = await prisma.vaultItem.findUnique({
      where: { id },
    });

    if (!item) {
      console.log("[DELETE Vault Item] Item not found:", id);
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    console.log("[DELETE Vault Item] Found item:", { id: item.id, folderId: item.folderId, clerkId: item.clerkId, profileId: item.profileId });

    // Check if user is the owner OR has access to the profile via organization sharing OR has EDIT permission on the folder
    const isOwner = item.clerkId === userId;
    console.log("[DELETE Vault Item] Is owner:", isOwner, "item.clerkId:", item.clerkId, "userId:", userId);
    
    // Check if user has access to the profile (their own or via organization)
    const hasProfileAccess = await hasAccessToProfileSimple(userId, item.profileId);
    console.log("[DELETE Vault Item] Has profile access:", hasProfileAccess);
    
    if (!isOwner && !hasProfileAccess) {
      // Check if user has EDIT permission on the folder via sharing
      const sharePermission = await prisma.vaultFolderShare.findUnique({
        where: {
          vaultFolderId_sharedWithClerkId: {
            vaultFolderId: item.folderId,
            sharedWithClerkId: userId,
          },
        },
      });

      console.log("[DELETE Vault Item] Share permission check:", { 
        folderId: item.folderId, 
        sharedWithClerkId: userId,
        shareFound: !!sharePermission,
        permission: sharePermission?.permission 
      });

      if (!sharePermission || sharePermission.permission !== 'EDIT') {
        console.log("[DELETE Vault Item] Permission denied - not owner, no profile access, and no EDIT permission");
        return NextResponse.json(
          { error: "You don't have permission to delete this item. You must be the owner, a member of the profile's organization, or have EDIT access to the folder." },
          { status: 403 }
        );
      }
    }

    // Delete from S3
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: item.awsS3Key,
        })
      );
      console.log("[DELETE Vault Item] S3 delete successful for key:", item.awsS3Key);
    } catch (s3Error) {
      console.error("[DELETE Vault Item] Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    const deleteResult = await prisma.vaultItem.delete({
      where: { id },
    });
    console.log("[DELETE Vault Item] Database delete successful:", deleteResult.id);

    // Track storage deletion (non-blocking)
    if (item.fileSize && item.fileSize > 0) {
      trackStorageDelete(item.clerkId, item.fileSize).catch((error) => {
        console.error('[DELETE Vault Item] Failed to track storage deletion:', error);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE Vault Item] Error deleting vault item:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
