// app/api/instagram/feed-post-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

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

    const whereClause: any = {
      clerkId: user.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    const isAllProfiles = !profileId || profileId === "all";

    // Build profile map for "all profiles" mode
    let profileMap: Record<string, string> = {};
    if (isAllProfiles) {
      const profiles = await prisma.instagramProfile.findMany({
        where: { clerkId: user.id },
        select: { id: true, name: true },
      });
      profileMap = profiles.reduce((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {} as Record<string, string>);
    }

    if (!isAllProfiles) {
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

    // Parse timeSlot as DateTime
    const timeSlotDate = new Date(timeSlot);

    // Generate unique content ID
    const feedPostDate = new Date(date);
    const year = feedPostDate.getFullYear();
    const month = String(feedPostDate.getMonth() + 1).padStart(2, '0');
    const day = String(feedPostDate.getDate()).padStart(2, '0');
    
    // Count existing feed posts for this day to generate sequence number
    const existingFeedPostsCount = await prisma.feedPostPlanningSlot.count({
      where: {
        clerkId: user.id,
        date: feedPostDate,
      },
    });
    
    const contentId = `POST-${year}${month}${day}-${String(existingFeedPostsCount + 1).padStart(3, '0')}`;

    // Create feed post slot
    const slot = await prisma.feedPostPlanningSlot.create({
      data: {
        clerkId: user.id,
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
