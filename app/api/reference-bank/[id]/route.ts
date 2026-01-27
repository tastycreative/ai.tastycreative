import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// GET - Get a single reference item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const item = await prisma.reference_items.findFirst({
      where: {
        id,
        clerkId: userId,
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Reference item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching reference item:", error);
    return NextResponse.json(
      { error: "Failed to fetch reference item" },
      { status: 500 }
    );
  }
}

// PATCH - Update a reference item (including move to folder and toggle favorite)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, tags, folderId, isFavorite } = body;

    // Verify the item belongs to the user
    const existingItem = await prisma.reference_items.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Reference item not found" },
        { status: 404 }
      );
    }

    // If folderId is provided (and not null), verify folder belongs to user
    if (folderId !== undefined && folderId !== null) {
      const folder = await prisma.reference_folders.findFirst({
        where: {
          id: folderId,
          clerkId: userId,
        },
      });

      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    const updatedItem = await prisma.reference_items.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingItem.name,
        description: description !== undefined ? description : existingItem.description,
        tags: tags !== undefined ? tags : existingItem.tags,
        folderId: folderId !== undefined ? folderId : existingItem.folderId,
        isFavorite: isFavorite !== undefined ? isFavorite : existingItem.isFavorite,
        updatedAt: new Date(),
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Error updating reference item:", error);
    return NextResponse.json(
      { error: "Failed to update reference item" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a reference item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the item belongs to the user and get the S3 key
    const item = await prisma.reference_items.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Reference item not found" },
        { status: 404 }
      );
    }

    // Delete from S3
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET || "tastycreative",
        Key: item.awsS3Key,
      });
      await s3Client.send(deleteCommand);
    } catch (s3Error) {
      console.error("Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 delete fails
    }

    // Delete from database
    await prisma.reference_items.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reference item:", error);
    return NextResponse.json(
      { error: "Failed to delete reference item" },
      { status: 500 }
    );
  }
}
