// app/api/instagram/story-slots/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// PATCH: Update a story slot
export async function PATCH(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      timeSlot,
      storyType,
      interactiveElement,
      notes,
      caption,
      hashtags,
      linkedPostId,
      awsS3Key,
      awsS3Url,
      fileName,
      mimeType,
      isPosted,
      postedAt,
    } = body;

    // Derive id from request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify ownership
    const existingSlot = await prisma.storyPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: "Story slot not found" },
        { status: 404 }
      );
    }

    if (existingSlot.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};
    if (timeSlot !== undefined) updateData.timeSlot = new Date(timeSlot);
    if (storyType !== undefined) updateData.storyType = storyType;
    if (interactiveElement !== undefined)
      updateData.interactiveElement = interactiveElement;
    if (notes !== undefined) updateData.notes = notes;
    if (caption !== undefined) updateData.caption = caption;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (linkedPostId !== undefined) updateData.linkedPostId = linkedPostId;
    if (awsS3Key !== undefined) updateData.awsS3Key = awsS3Key;
    if (awsS3Url !== undefined) updateData.awsS3Url = awsS3Url;
    if (fileName !== undefined) updateData.fileName = fileName;
    if (mimeType !== undefined) updateData.mimeType = mimeType;
    if (isPosted !== undefined) updateData.isPosted = isPosted;
    if (postedAt !== undefined) updateData.postedAt = postedAt ? new Date(postedAt) : null;

    // Handle pipeline item creation/update based on posted status
    if (isPosted === true && !existingSlot.pipelineItemId) {
      // Story is being marked as posted for the first time - create pipeline item
      const timeDisplay = existingSlot.timeSlot ? new Date(existingSlot.timeSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'No time';
      const pipelineItem = await prisma.contentPipelineItem.create({
        data: {
          clerkId: user.id,
          contentId: existingSlot.contentId || `STORY-${Date.now()}`,
          title: `${storyType || existingSlot.storyType} Story - ${timeDisplay}`,
          contentType: "STORY",
          status: "POSTED",
          notes: notes || existingSlot.notes || undefined,
          dateCreated: existingSlot.createdAt,
          datePosted: new Date(),
          ideaDate: existingSlot.createdAt,
          filmingDate: existingSlot.awsS3Url ? existingSlot.createdAt : undefined,
        },
      });

      // Link the pipeline item to the story slot
      updateData.pipelineItemId = pipelineItem.id;
    } else if (isPosted === true && existingSlot.pipelineItemId) {
      // Pipeline item already exists, just update it
      const pipelineUpdateData: any = {
        status: "POSTED",
        datePosted: new Date(),
        updatedAt: new Date(),
      };

      if (storyType) {
        const timeDisplay = existingSlot.timeSlot ? new Date(existingSlot.timeSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'No time';
        pipelineUpdateData.title = `${storyType} Story - ${timeDisplay}`;
      }

      if (notes !== undefined) {
        pipelineUpdateData.notes = notes;
      }

      await prisma.contentPipelineItem.update({
        where: { id: existingSlot.pipelineItemId },
        data: pipelineUpdateData,
      });
    } else if (isPosted === false && existingSlot.pipelineItemId) {
      // Story is being unmarked as posted - delete pipeline item
      await prisma.contentPipelineItem.delete({
        where: { id: existingSlot.pipelineItemId },
      });
      updateData.pipelineItemId = null;
    }

    const updatedSlot = await prisma.storyPlanningSlot.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
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
        pipelineItem: true,
      },
    });

    return NextResponse.json({ slot: updatedSlot });
  } catch (error) {
    console.error("Error updating story slot:", error);
    return NextResponse.json(
      { error: "Failed to update story slot" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a story slot
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive id from request URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    // Verify ownership
    const existingSlot = await prisma.storyPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: "Story slot not found" },
        { status: 404 }
      );
    }

    if (existingSlot.clerkId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the pipeline item if it exists (only exists for posted stories)
    if (existingSlot.pipelineItemId) {
      await prisma.contentPipelineItem.delete({
        where: { id: existingSlot.pipelineItemId },
      });
    }

    await prisma.storyPlanningSlot.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Story slot deleted successfully" });
  } catch (error) {
    console.error("Error deleting story slot:", error);
    return NextResponse.json(
      { error: "Failed to delete story slot" },
      { status: 500 }
    );
  }
}
