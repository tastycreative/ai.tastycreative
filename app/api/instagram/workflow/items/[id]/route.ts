// app/api/instagram/workflow/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// PATCH: Update a checklist item
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { text, order, checked } = body;

    // Verify ownership through phase
    const existingItem = await prisma.workflowCheckItem.findUnique({
      where: { id: params.id },
      include: { phase: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }

    if (existingItem.phase.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedItem = await prisma.workflowCheckItem.update({
      where: { id: params.id },
      data: {
        text: text !== undefined ? text : undefined,
        order: order !== undefined ? order : undefined,
        checked: checked !== undefined ? checked : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error("Error updating checklist item:", error);
    return NextResponse.json(
      { error: "Failed to update checklist item" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a checklist item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership through phase
    const existingItem = await prisma.workflowCheckItem.findUnique({
      where: { id: params.id },
      include: { phase: true },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Checklist item not found" },
        { status: 404 }
      );
    }

    if (existingItem.phase.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.workflowCheckItem.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "Checklist item deleted successfully" });
  } catch (error) {
    console.error("Error deleting checklist item:", error);
    return NextResponse.json(
      { error: "Failed to delete checklist item" },
      { status: 500 }
    );
  }
}
