import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Get a single folder with its items
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

    const folder = await prisma.reference_folders.findFirst({
      where: {
        id,
        clerkId: userId,
      },
      include: {
        items: {
          orderBy: {
            createdAt: "desc",
          },
        },
        children: {
          include: {
            _count: {
              select: { items: true },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Error fetching folder:", error);
    return NextResponse.json(
      { error: "Failed to fetch folder" },
      { status: 500 }
    );
  }
}

// PATCH - Update a folder
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
    const { name, description, color, icon, parentId } = body;

    // Verify the folder belongs to the user
    const existingFolder = await prisma.reference_folders.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // If name is being changed, check for duplicates
    if (name && name !== existingFolder.name) {
      const newParentId = parentId !== undefined ? parentId : existingFolder.parentId;
      const duplicateFolder = await prisma.reference_folders.findFirst({
        where: {
          clerkId: userId,
          name: name.trim(),
          parentId: newParentId,
          NOT: {
            id,
          },
        },
      });

      if (duplicateFolder) {
        return NextResponse.json(
          { error: "A folder with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Prevent circular reference
    if (parentId === id) {
      return NextResponse.json(
        { error: "A folder cannot be its own parent" },
        { status: 400 }
      );
    }

    const updatedFolder = await prisma.reference_folders.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existingFolder.name,
        description: description !== undefined ? description : existingFolder.description,
        color: color !== undefined ? color : existingFolder.color,
        icon: icon !== undefined ? icon : existingFolder.icon,
        parentId: parentId !== undefined ? parentId : existingFolder.parentId,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a folder (items will have folderId set to null)
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

    // Verify the folder belongs to the user
    const folder = await prisma.reference_folders.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Move child folders to parent (or root if no parent)
    await prisma.reference_folders.updateMany({
      where: {
        parentId: id,
        clerkId: userId,
      },
      data: {
        parentId: folder.parentId,
      },
    });

    // Items will automatically have folderId set to null due to onDelete: SetNull

    // Delete the folder
    await prisma.reference_folders.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
