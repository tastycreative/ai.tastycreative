// app/api/instagram/reel-slots/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET: Fetch a specific reel slot
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[parts.length - 1];

    const slot = await prisma.reelPlanningSlot.findUnique({
      where: {
        id,
        clerkId: user.id,
      },
      include: {
        pipelineItem: true,
      },
    });

    if (!slot) {
      return NextResponse.json({ error: "Reel slot not found" }, { status: 404 });
    }

    return NextResponse.json({ slot });
  } catch (error) {
    console.error("Error fetching reel slot:", error);
    return NextResponse.json(
      { error: "Failed to fetch reel slot" },
      { status: 500 }
    );
  }
}

// PATCH: Update a reel slot
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
      reelType,
      hookIdea,
      trendingAudio,
      notes,
      caption,
      hashtags,
      awsS3Key,
      awsS3Url,
      fileName,
      mimeType,
      isPosted,
      postedAt,
    } = body;

    // Check if slot exists and belongs to user
    const existingSlot = await prisma.reelPlanningSlot.findFirst({
      where: {
        id,
        clerkId: user.id,
      },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Reel slot not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (timeSlot !== undefined) updateData.timeSlot = new Date(timeSlot);
    if (reelType !== undefined) updateData.reelType = reelType;
    if (hookIdea !== undefined) updateData.hookIdea = hookIdea;
    if (trendingAudio !== undefined) updateData.trendingAudio = trendingAudio;
    if (notes !== undefined) updateData.notes = notes;
    if (caption !== undefined) updateData.caption = caption;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (awsS3Key !== undefined) updateData.awsS3Key = awsS3Key;
    if (awsS3Url !== undefined) updateData.awsS3Url = awsS3Url;
    if (fileName !== undefined) updateData.fileName = fileName;
    if (mimeType !== undefined) updateData.mimeType = mimeType;
    if (isPosted !== undefined) updateData.isPosted = isPosted;
    if (postedAt !== undefined) updateData.postedAt = postedAt ? new Date(postedAt) : null;

    // If marking as posted, create/update pipeline item
    if (isPosted && !existingSlot.pipelineItemId) {
      const pipelineItem = await prisma.contentPipelineItem.create({
        data: {
          clerkId: user.id,
          contentId: existingSlot.contentId || `REEL-${Date.now()}`,
          title: `Reel - ${existingSlot.reelType}`,
          contentType: 'REEL',
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

    const slot = await prisma.reelPlanningSlot.update({
      where: { id },
      data: updateData,
      include: {
        pipelineItem: true,
      },
    });

    return NextResponse.json({ slot });
  } catch (error) {
    console.error("Error updating reel slot:", error);
    return NextResponse.json(
      { error: "Failed to update reel slot" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a reel slot
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
    const existingSlot = await prisma.reelPlanningSlot.findFirst({
      where: {
        id,
        clerkId: user.id,
      },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Reel slot not found" }, { status: 404 });
    }

    // Delete the associated pipeline item first if it exists
    if (existingSlot.pipelineItemId) {
      await prisma.contentPipelineItem.delete({
        where: { id: existingSlot.pipelineItemId },
      });
    }

    // Delete the slot
    await prisma.reelPlanningSlot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reel slot:", error);
    return NextResponse.json(
      { error: "Failed to delete reel slot" },
      { status: 500 }
    );
  }
}
