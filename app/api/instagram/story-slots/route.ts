// app/api/instagram/story-slots/route.ts
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
        clerkId: { not: userId }, // Exclude own profiles already added
      },
      select: { id: true },
    });
    profileIds.push(...orgProfiles.map(p => p.id));
  }

  return profileIds;
}

// GET: Fetch story slots for a date range
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
    const isAllProfiles = profileId === "all";

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Get all accessible profile IDs (own + shared)
    const accessibleProfileIds = await getAccessibleProfileIds(user.id);

    // Build profile map for adding profile names
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
    } else if (profileId) {
      // Verify access to the specific profile
      const { hasAccess } = await hasAccessToProfile(user.id, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this profile" }, { status: 403 });
      }
      whereClause.profileId = profileId;
    } else {
      // No profile specified - only own profiles
      whereClause.clerkId = user.id;
    }

    const slots = await prisma.storyPlanningSlot.findMany({
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
          },
        },
        pipelineItem: {
          select: {
            id: true,
            contentId: true,
            status: true,
            dateCreated: true,
            datePosted: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { timeSlot: "asc" },
      ],
    });

    // Add profileName to each slot
    const slotsWithProfileName = slots.map((slot) => ({
      ...slot,
      profileName: slot.profileId ? profileMap[slot.profileId] || null : null,
    }));

    return NextResponse.json({ slots: slotsWithProfileName });
  } catch (error) {
    console.error("Error fetching story slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch story slots" },
      { status: 500 }
    );
  }
}

// POST: Create a new story slot
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
      storyType,
      interactiveElement,
      notes,
      caption,
      hashtags,
      linkedPostId,
      profileId,
      awsS3Key,
      awsS3Url,
      fileName,
      mimeType,
    } = body;

    if (!date || !timeSlot || !storyType) {
      return NextResponse.json(
        { error: "date, timeSlot, and storyType are required" },
        { status: 400 }
      );
    }

    // Verify access to the profile if provided
    let targetClerkId = user.id;
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(user.id, profileId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Unauthorized to access this profile" }, { status: 403 });
      }
      // Use the profile owner's clerkId for the slot
      targetClerkId = profile.clerkId;
    }

    // Parse timeSlot as DateTime (expects ISO string or date string)
    const timeSlotDate = new Date(timeSlot);

    // Generate unique content ID with UUID suffix to prevent collisions
    const storyDate = new Date(date);
    const year = storyDate.getFullYear();
    const month = String(storyDate.getMonth() + 1).padStart(2, '0');
    const day = String(storyDate.getDate()).padStart(2, '0');
    const shortUuid = uuidv4().split('-')[0]; // Use first segment of UUID for brevity
    
    const contentId = `STORY-${year}${month}${day}-${shortUuid}`;

    // Check if a slot already exists for this time
    const existingSlot = await prisma.storyPlanningSlot.findUnique({
      where: {
        clerkId_profileId_timeSlot: {
          clerkId: targetClerkId,
          profileId: profileId || null,
          timeSlot: timeSlotDate,
        },
      },
    });

    if (existingSlot) {
      return NextResponse.json(
        { error: "A story slot already exists for this time. Please choose a different time or edit the existing slot." },
        { status: 409 }
      );
    }

    // Create story slot (pipeline item will be created when marked as posted)
    const slot = await prisma.storyPlanningSlot.create({
      data: {
        clerkId: targetClerkId,
        profileId,
        contentId,
        pipelineItemId: null, // Will be set when posted
        date: storyDate,
        timeSlot: timeSlotDate,
        storyType,
        interactiveElement: interactiveElement || null,
        notes,
        caption,
        hashtags: hashtags || [],
        linkedPostId,
        awsS3Key,
        awsS3Url,
        fileName,
        mimeType,
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

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    console.error("Error creating story slot:", error);
    return NextResponse.json(
      { error: "Failed to create story slot" },
      { status: 500 }
    );
  }
}
