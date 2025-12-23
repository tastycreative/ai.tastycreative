// app/api/instagram/workflow/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST: Create a new checklist item
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phaseId, text, order } = body;

    if (!phaseId || !text) {
      return NextResponse.json(
        { error: "phaseId and text are required" },
        { status: 400 }
      );
    }

    // Verify phase ownership
    const phase = await prisma.workflowPhase.findUnique({
      where: { id: phaseId },
    });

    if (!phase || phase.clerkId !== user.id) {
      return NextResponse.json(
        { error: "Phase not found or forbidden" },
        { status: 403 }
      );
    }

    const item = await prisma.workflowCheckItem.create({
      data: {
        phaseId,
        text,
        order: order ?? 0,
        checked: false,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error creating checklist item:", error);
    return NextResponse.json(
      { error: "Failed to create checklist item" },
      { status: 500 }
    );
  }
}
