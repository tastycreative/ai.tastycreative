import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

    // Verify ownership of the item
    const item = await prisma.vaultItem.findFirst({
      where: { id, clerkId: userId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Verify ownership of the destination folder
    const folder = await prisma.vaultFolder.findFirst({
      where: { id: folderId, clerkId: userId },
    });

    if (!folder) {
      return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
    }

    // Ensure the folder belongs to the same profile as the item
    if (folder.profileId !== item.profileId) {
      return NextResponse.json(
        { error: "Cannot move item to a folder in a different profile" },
        { status: 400 }
      );
    }

    // Update the item's folder
    const updatedItem = await prisma.vaultItem.update({
      where: { id },
      data: { folderId },
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

    // Verify ownership and get item
    const item = await prisma.vaultItem.findFirst({
      where: { id, clerkId: userId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Delete from S3
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: item.awsS3Key,
        })
      );
    } catch (s3Error) {
      console.error("Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await prisma.vaultItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vault item:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}
