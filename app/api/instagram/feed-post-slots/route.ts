// app/api/instagram/feed-post-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// Helper function to check if user has access to a profile (own profile or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{ hasAccess: boolean; profile: any | null; isShared: boolean }> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile, isShared: false };
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
      return { hasAccess: true, profile: orgProfile, isShared: true };
    }
  }

  return { hasAccess: false, profile: null, isShared: false };
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

// GET: Fetch feed post slots for a date range
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const profileId = searchParams.get("profileId");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const isAllProfiles = !profileId || profileId === "all";

    // Get all accessible profile IDs (own + shared)
    const accessibleProfileIds = await getAccessibleProfileIds(user.id);

    // Build profile map for all accessible profiles
    const allProfiles = await prisma.instagramProfile.findMany({
      where: { id: { in: accessibleProfileIds } },
      select: { id: true, name: true, clerkId: true },
    });
    const profileMap = allProfiles.reduce((acc, p) => {
      acc[p.id] = p.name;
      return acc;
    }, {} as Record<string, string>);

    let whereClause: any = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (isAllProfiles) {
      // For "all profiles", query by accessible profile IDs
      whereClause.profileId = { in: accessibleProfileIds };
    } else {
      // Verify access to the specific profile
      const { hasAccess } = await hasAccessToProfile(user.id, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this profile" }, { status: 403 });
      }
      whereClause.profileId = profileId;
    }

    const slots = await prisma.feedPostPlanningSlot.findMany({
      where: whereClause,
      include: {
        pipelineItem: true,
      },
      orderBy: [
        { date: "asc" },
        { timeSlot: "asc" },
      ],
    });

    // Add profileName to each slot when in "all profiles" mode
    const slotsWithProfileName = slots.map((slot) => ({
      ...slot,
      profileName: isAllProfiles && slot.profileId ? profileMap[slot.profileId] || "Unknown" : undefined,
    }));

    return NextResponse.json({ slots: slotsWithProfileName });
  } catch (error) {
    console.error("Error fetching feed post slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed post slots" },
      { status: 500 }
    );
  }
}

// POST: Create a new feed post slot
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      date,
      timeSlot,
      postType,
      caption,
      hashtags,
      location,
      collaborators,
      notes,
      profileId,
      files,
    } = body;

    if (!date || !timeSlot || !postType) {
      return NextResponse.json(
        { error: "date, timeSlot, and postType are required" },
        { status: 400 }
      );
    }

    // Determine the target clerkId - if this is a shared profile, use the profile owner's clerkId
    let targetClerkId = user.id;
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(user.id, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this profile" }, { status: 403 });
      }
      // Use the profile owner's clerkId for data association
      targetClerkId = profile.clerkId;
    }

    // Parse timeSlot as DateTime
    const timeSlotDate = new Date(timeSlot);

    // Generate unique content ID with UUID suffix to prevent collisions
    const feedPostDate = new Date(date);
    const year = feedPostDate.getFullYear();
    const month = String(feedPostDate.getMonth() + 1).padStart(2, '0');
    const day = String(feedPostDate.getDate()).padStart(2, '0');
    const shortUuid = uuidv4().split('-')[0]; // Use first segment of UUID for brevity
    
    const contentId = `POST-${year}${month}${day}-${shortUuid}`;

    // Create feed post slot
    const slot = await prisma.feedPostPlanningSlot.create({
      data: {
        clerkId: targetClerkId,
        profileId,
        contentId,
        pipelineItemId: null,
        date: feedPostDate,
        timeSlot: timeSlotDate,
        postType,
        caption,
        hashtags: hashtags || [],
        location,
        collaborators: collaborators || [],
        notes,
        files: files || null,
      },
      include: {
        pipelineItem: true,
      },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    console.error("Error creating feed post slot:", error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return NextResponse.json(
        { error: "A feed post is already planned for this time slot!" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create feed post slot" },
      { status: 500 }
    );
  }
}
