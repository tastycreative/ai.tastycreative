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

// PATCH /api/vault/folders/[id] - Update folder name
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
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Verify ownership
    const folder = await prisma.vaultFolder.findFirst({
      where: { id, clerkId: userId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Prevent renaming default folder
    if (folder.isDefault) {
      return NextResponse.json(
        { error: "Cannot rename default folder" },
        { status: 400 }
      );
    }

    const updatedFolder = await prisma.vaultFolder.update({
      where: { id },
      data: { name },
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

    // Verify ownership
    const folder = await prisma.vaultFolder.findFirst({
      where: { id, clerkId: userId },
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
