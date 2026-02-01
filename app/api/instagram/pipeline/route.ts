// app/api/instagram/pipeline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// Helper to get all accessible clerkIds for a user (own + organization-shared profiles' owners)
async function getAccessibleClerkIds(userId: string): Promise<string[]> {
  const clerkIds = [userId];

  // Get organization shared profiles and their owners
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfiles = await prisma.instagramProfile.findMany({
      where: {
        organizationId: user.currentOrganizationId,
        clerkId: { not: userId },
      },
      select: { clerkId: true },
    });
    // Add unique clerkIds from shared profiles
    orgProfiles.forEach(p => {
      if (!clerkIds.includes(p.clerkId)) {
        clerkIds.push(p.clerkId);
      }
    });
  }

  return clerkIds;
}

// Helper to get all accessible profile IDs for a user
async function getAccessibleProfileIds(userId: string): Promise<string[]> {
  // Get user's own profiles
  const ownProfiles = await prisma.instagramProfile.findMany({
    where: { clerkId: userId },
    select: { id: true },
  });

  const profileIds = ownProfiles.map(p => p.id);

  // Get organization shared profiles
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfiles = await prisma.instagramProfile.findMany({
      where: {
        organizationId: user.currentOrganizationId,
        clerkId: { not: userId },
      },
      select: { id: true },
    });
    profileIds.push(...orgProfiles.map(p => p.id));
  }

  return profileIds;
}

// GET: Fetch all pipeline items with filters
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const contentType = searchParams.get("contentType");
    const profileId = searchParams.get("profileId");

    // Get all accessible clerkIds (own + shared profile owners)
    const accessibleClerkIds = await getAccessibleClerkIds(user.id);
    const accessibleProfileIds = await getAccessibleProfileIds(user.id);

    const whereClause: any = {
      clerkId: { in: accessibleClerkIds },
    };

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (contentType && contentType !== "all") {
      whereClause.contentType = contentType;
    }

    // Build profile filter for related slots
    // When filtering by a specific profile, only show that profile's slots
    // When viewing all profiles, show slots from accessible profiles OR slots with null profileId (legacy data)
    const profileFilter = profileId && profileId !== "all" 
      ? { profileId } 
      : { OR: [{ profileId: { in: accessibleProfileIds } }, { profileId: null }] };

    const items = await prisma.contentPipelineItem.findMany({
      where: whereClause,
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
        storySlot: {
          include: {
            linkedPost: {
              select: {
                id: true,
                fileName: true,
                awsS3Url: true,
                driveFileUrl: true,
              },
            },
          },
        },
        reelSlot: true,
        feedPostSlot: true,
      },
      orderBy: [
        { updatedAt: "desc" },
      ],
    });

    // Filter items based on profile access
    const filteredItems = items.filter(item => {
      // Check if the item has an associated slot that the user can access
      const storyProfileOk = !item.storySlot || 
        item.storySlot.profileId === null || 
        accessibleProfileIds.includes(item.storySlot.profileId) ||
        (profileId && profileId !== "all" && item.storySlot.profileId === profileId);
      
      const reelProfileOk = !item.reelSlot || 
        item.reelSlot.profileId === null || 
        accessibleProfileIds.includes(item.reelSlot.profileId) ||
        (profileId && profileId !== "all" && item.reelSlot.profileId === profileId);
      
      const feedPostProfileOk = !item.feedPostSlot || 
        item.feedPostSlot.profileId === null || 
        accessibleProfileIds.includes(item.feedPostSlot.profileId) ||
        (profileId && profileId !== "all" && item.feedPostSlot.profileId === profileId);

      // If a specific profile is selected, at least one slot must match
      if (profileId && profileId !== "all") {
        return (item.storySlot?.profileId === profileId) ||
               (item.reelSlot?.profileId === profileId) ||
               (item.feedPostSlot?.profileId === profileId) ||
               item.linkedPost;
      }

      // For "all profiles" view, include if user has access to any associated slot
      return storyProfileOk && reelProfileOk && feedPostProfileOk;
    });

    return NextResponse.json({ items: filteredItems });
  } catch (error) {
    console.error("Error fetching pipeline items:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline items" },
      { status: 500 }
    );
  }
}

// POST: Create a new pipeline item
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      contentId,
      title,
      contentType,
      status = "IDEA",
      notes,
      dateCreated,
      linkedPostId,
    } = body;

    if (!contentId || !title || !contentType) {
      return NextResponse.json(
        { error: "contentId, title, and contentType are required" },
        { status: 400 }
      );
    }

    // Check if contentId already exists
    const existing = await prisma.contentPipelineItem.findUnique({
      where: { contentId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Content ID already exists" },
        { status: 409 }
      );
    }

    const now = new Date();
    const stageData: any = {};

    // Set stage timestamps based on status
    if (status === "IDEA") stageData.ideaDate = now;
    if (status === "FILMING") stageData.filmingDate = now;
    if (status === "EDITING") stageData.editingDate = now;
    if (status === "REVIEW") stageData.reviewDate = now;
    if (status === "APPROVED") stageData.approvedDate = now;
    if (status === "SCHEDULED") stageData.scheduledDate = now;
    if (status === "POSTED") {
      stageData.datePosted = now;
    }

    const item = await prisma.contentPipelineItem.create({
      data: {
        clerkId: user.id,
        contentId,
        title,
        contentType,
        status,
        notes,
        dateCreated: dateCreated ? new Date(dateCreated) : now,
        linkedPostId,
        ...stageData,
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
            scheduledDate: true,
          },
        },
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Error creating pipeline item:", error);
    return NextResponse.json(
      { error: "Failed to create pipeline item" },
      { status: 500 }
    );
  }
}
