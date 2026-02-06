import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";

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
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

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
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Prevent modifying default folder
    if (folder.isDefault && (name || parentId !== undefined)) {
      // Allow moving default folder's parentId but not renaming
      if (name) {
        return NextResponse.json(
          { error: "Cannot rename default folder" },
          { status: 400 }
        );
      }
    }

    // Check if user has access to the profile this folder belongs to
    const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this folder" },
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
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Prevent deleting default folder
    if (folder.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete default folder" },
        { status: 400 }
      );
    }

    // Check if user has access to the profile this folder belongs to
    const { hasAccess } = await hasAccessToProfile(userId, folder.profileId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied to this folder" },
        { status: 403 }
      );
    }

    // Get all items in the folder to delete from S3
    const items = await prisma.vaultItem.findMany({
      where: { folderId: id },
      select: { awsS3Key: true },
    });

    // Delete all S3 files in the folder
    if (items.length > 0) {
      try {
        // S3 DeleteObjects can handle up to 1000 objects at a time
        const batchSize = 1000;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          await s3Client.send(
            new DeleteObjectsCommand({
              Bucket: process.env.AWS_S3_BUCKET!,
              Delete: {
                Objects: batch.map((item) => ({ Key: item.awsS3Key })),
                Quiet: true,
              },
            })
          );
        }
      } catch (s3Error) {
        console.error("Error deleting S3 files:", s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete folder (items will cascade delete)
    await prisma.vaultFolder.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vault folder:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
