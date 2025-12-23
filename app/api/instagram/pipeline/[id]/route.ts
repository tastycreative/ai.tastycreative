// app/api/instagram/pipeline/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// PATCH: Update a pipeline item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      contentType,
      status,
      notes,
      dateCreated,
      linkedPostId,
    } = body;

    // Verify ownership
    const existingItem = await prisma.contentPipelineItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};
    const now = new Date();

    if (title !== undefined) updateData.title = title;
    if (contentType !== undefined) updateData.contentType = contentType;
    if (notes !== undefined) updateData.notes = notes;
    if (dateCreated !== undefined) updateData.dateCreated = dateCreated ? new Date(dateCreated) : null;
    if (linkedPostId !== undefined) updateData.linkedPostId = linkedPostId;

    // Update stage timestamps when status changes
    if (status !== undefined && status !== existingItem.status) {
      updateData.status = status;

      if (status === "IDEA" && !existingItem.ideaDate) {
        updateData.ideaDate = now;
      }
      if (status === "FILMING" && !existingItem.filmingDate) {
        updateData.filmingDate = now;
      }
      if (status === "EDITING" && !existingItem.editingDate) {
        updateData.editingDate = now;
      }
      if (status === "REVIEW" && !existingItem.reviewDate) {
        updateData.reviewDate = now;
      }
      if (status === "APPROVED" && !existingItem.approvedDate) {
        updateData.approvedDate = now;
      }
      if (status === "SCHEDULED" && !existingItem.scheduledDate) {
        updateData.scheduledDate = now;
      }
      if (status === "POSTED" && !existingItem.datePosted) {
        updateData.datePosted = now;
      }
    }

    const updatedItem = await prisma.contentPipelineItem.update({
      where: { id },
      data: updateData,
      include: {
        linkedPost: {
          select: {
            id: true,
            fileName: true,
            awsS3Url: true,
            driveFileUrl: true,
            caption: true,
            status: true,
            postType: true,
            scheduledDate: true,
          },
        },
      },
    });

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error("Error updating pipeline item:", error);
    return NextResponse.json(
      { error: "Failed to update pipeline item" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a pipeline item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existingItem = await prisma.contentPipelineItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (existingItem.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.contentPipelineItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting pipeline item:", error);
    return NextResponse.json(
      { error: "Failed to delete pipeline item" },
      { status: 500 }
    );
  }
}
