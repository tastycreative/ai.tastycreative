// app/api/instagram/weekly-slots/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// PATCH: Update a weekly planning slot
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const {
      status,
      notes,
      hashtags,
      trendingAudio,
      contentIdeas,
      linkedPostId,
    } = body;

    // Verify ownership
    const existingSlot = await prisma.weeklyPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    if (existingSlot.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (trendingAudio !== undefined) updateData.trendingAudio = trendingAudio;
    if (contentIdeas !== undefined) updateData.contentIdeas = contentIdeas;
    if (linkedPostId !== undefined) updateData.linkedPostId = linkedPostId;

    const updatedSlot = await prisma.weeklyPlanningSlot.update({
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
          },
        },
      },
    });

    return NextResponse.json({ slot: updatedSlot });
  } catch (error) {
    console.error("Error updating weekly slot:", error);
    return NextResponse.json(
      { error: "Failed to update weekly slot" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a weekly planning slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Verify ownership
    const existingSlot = await prisma.weeklyPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    if (existingSlot.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.weeklyPlanningSlot.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Slot deleted successfully" });
  } catch (error) {
    console.error("Error deleting weekly slot:", error);
    return NextResponse.json(
      { error: "Failed to delete weekly slot" },
      { status: 500 }
    );
  }
}
