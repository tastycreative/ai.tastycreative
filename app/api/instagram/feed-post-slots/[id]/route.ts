// app/api/instagram/feed-post-slots/[id]/route.ts
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

    // First find the slot without clerkId filter
    const slot = await prisma.feedPostPlanningSlot.findUnique({
      where: { id },
      include: {
        pipelineItem: true,
      },
    });

    if (!slot) {
      return NextResponse.json({ error: "Feed post slot not found" }, { status: 404 });
    }

    // Verify access via profile
    if (slot.profileId) {
      const { hasAccess } = await hasAccessToProfile(user.id, slot.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this slot" }, { status: 403 });
      }
    } else if (slot.clerkId !== user.id) {
      // If no profileId, fall back to clerkId check
      return NextResponse.json({ error: "Unauthorized to access this slot" }, { status: 403 });
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

    // Find the slot first without clerkId filter
    const existingSlot = await prisma.feedPostPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Feed post slot not found" }, { status: 404 });
    }

    // Verify access via profile
    if (existingSlot.profileId) {
      const { hasAccess } = await hasAccessToProfile(user.id, existingSlot.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to update this slot" }, { status: 403 });
      }
    } else if (existingSlot.clerkId !== user.id) {
      return NextResponse.json({ error: "Unauthorized to update this slot" }, { status: 403 });
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
          clerkId: existingSlot.clerkId,
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

    // Find the slot first without clerkId filter
    const existingSlot = await prisma.feedPostPlanningSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json({ error: "Feed post slot not found" }, { status: 404 });
    }

    // Verify access via profile
    if (existingSlot.profileId) {
      const { hasAccess } = await hasAccessToProfile(user.id, existingSlot.profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to delete this slot" }, { status: 403 });
      }
    } else if (existingSlot.clerkId !== user.id) {
      return NextResponse.json({ error: "Unauthorized to delete this slot" }, { status: 403 });
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
