// app/api/instagram/workflow/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// PATCH: Update a workflow phase
export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, order } = body;

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify ownership
    const existingPhase = await prisma.workflowPhase.findUnique({
      where: { id },
    });

    if (!existingPhase) {
      return NextResponse.json(
        { error: "Workflow phase not found" },
        { status: 404 }
      );
    }

    if (existingPhase.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedPhase = await prisma.workflowPhase.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
        icon: icon !== undefined ? icon : undefined,
        color: color !== undefined ? color : undefined,
        order: order !== undefined ? order : undefined,
        updatedAt: new Date(),
      },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ phase: updatedPhase });
  } catch (error) {
    console.error("Error updating workflow phase:", error);
    return NextResponse.json(
      { error: "Failed to update workflow phase" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a workflow phase
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive id from the request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify ownership
    const existingPhase = await prisma.workflowPhase.findUnique({
      where: { id },
    });

    if (!existingPhase) {
      return NextResponse.json(
        { error: "Workflow phase not found" },
        { status: 404 }
      );
    }

    if (existingPhase.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.workflowPhase.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Workflow phase deleted successfully" });
  } catch (error) {
    console.error("Error deleting workflow phase:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow phase" },
      { status: 500 }
    );
  }
}
