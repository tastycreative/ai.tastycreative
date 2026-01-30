// app/api/instagram/reel-slots/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Check if it's a shared organization profile
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        organizationId: user.currentOrganizationId,
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

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
      where: { id },
      include: {
        pipelineItem: true,
      },
    });

    if (!slot) {
      return NextResponse.json({ error: "Reel slot not found" }, { status: 404 });
    }

    // Check access - either own slot or has access to the profile
    let hasAccess = slot.clerkId === user.id;
    if (!hasAccess && slot.profileId) {
      const profileAccess = await hasAccessToProfile(user.id, slot.profileId);
      hasAccess = profileAccess.hasAccess;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Check if slot exists
    const existingSlot = await prisma.reelPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Reel slot not found" }, { status: 404 });
    }

    // Check access - either own slot or has access to the profile
    let hasAccess = existingSlot.clerkId === user.id;
    if (!hasAccess && existingSlot.profileId) {
      const profileAccess = await hasAccessToProfile(user.id, existingSlot.profileId);
      hasAccess = profileAccess.hasAccess;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Check if slot exists
    const existingSlot = await prisma.reelPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Reel slot not found" }, { status: 404 });
    }

    // Check access - either own slot or has access to the profile
    let hasAccess = existingSlot.clerkId === user.id;
    if (!hasAccess && existingSlot.profileId) {
      const profileAccess = await hasAccessToProfile(user.id, existingSlot.profileId);
      hasAccess = profileAccess.hasAccess;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
