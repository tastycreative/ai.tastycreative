// app/api/instagram/feed-post-slots/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// GET: Fetch a specific feed post slot
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  // Derive id from the request URL
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

    const slot = await prisma.feedPostPlanningSlot.findUnique({
      where: {
        id,
        clerkId: user.id,
      },
      include: {
        pipelineItem: true,
      },
    });

    if (!slot) {
      return NextResponse.json({ error: "Feed post slot not found" }, { status: 404 });
    }

    return NextResponse.json({ slot });
  } catch (error) {
    console.error("Error fetching feed post slot:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed post slot" },
      { status: 500 }
    );
  }
}

// PATCH: Update a feed post slot
export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];
    const body = await request.json();
    const {
      timeSlot,
      postType,
      caption,
      hashtags,
      location,
      collaborators,
      notes,
      files,
      isPosted,
      postedAt,
    } = body;

    // Check if slot exists and belongs to user
    const existingSlot = await prisma.feedPostPlanningSlot.findFirst({
      where: {
        id,
        clerkId: user.id,
      },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Feed post slot not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (timeSlot !== undefined) updateData.timeSlot = new Date(timeSlot);
    if (postType !== undefined) updateData.postType = postType;
    if (caption !== undefined) updateData.caption = caption;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (location !== undefined) updateData.location = location;
    if (collaborators !== undefined) updateData.collaborators = collaborators;
    if (notes !== undefined) updateData.notes = notes;
    if (files !== undefined) updateData.files = files;
    if (isPosted !== undefined) updateData.isPosted = isPosted;
    if (postedAt !== undefined) updateData.postedAt = postedAt ? new Date(postedAt) : null;

    // If marking as posted, create/update pipeline item
    if (isPosted && !existingSlot.pipelineItemId) {
      const pipelineItem = await prisma.contentPipelineItem.create({
        data: {
          clerkId: user.id,
          contentId: existingSlot.contentId || `POST-${Date.now()}`,
          title: `Feed Post - ${existingSlot.postType}`,
          contentType: 'POST',
          status: 'POSTED',
          datePosted: new Date(),
        },
      });
      updateData.pipelineItemId = pipelineItem.id;
    }
    
    // If unmarking as posted, delete the pipeline item
    if (isPosted === false && existingSlot.pipelineItemId) {
      await prisma.contentPipelineItem.delete({
        where: { id: existingSlot.pipelineItemId },
      });
      updateData.pipelineItemId = null;
    }

    const slot = await prisma.feedPostPlanningSlot.update({
      where: { id },
      data: updateData,
      include: {
        pipelineItem: true,
      },
    });

    return NextResponse.json({ slot });
  } catch (error) {
    console.error("Error updating feed post slot:", error);
    return NextResponse.json(
      { error: "Failed to update feed post slot" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a feed post slot
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

    // Check if slot exists and belongs to user
    const existingSlot = await prisma.feedPostPlanningSlot.findFirst({
      where: {
        id,
        clerkId: user.id,
      },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Feed post slot not found" }, { status: 404 });
    }

    // Delete the associated pipeline item first if it exists
    if (existingSlot.pipelineItemId) {
      await prisma.contentPipelineItem.delete({
        where: { id: existingSlot.pipelineItemId },
      });
    }

    // Delete the slot
    await prisma.feedPostPlanningSlot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting feed post slot:", error);
    return NextResponse.json(
      { error: "Failed to delete feed post slot" },
      { status: 500 }
    );
  }
}
