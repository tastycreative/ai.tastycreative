// app/api/instagram/weekly-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET: Fetch weekly planning slots for a date range
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

    if (profileId && profileId !== "all") {
      whereClause.profileId = profileId;
    }

    const slots = await prisma.weeklyPlanningSlot.findMany({
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
      },
      orderBy: [
        { date: "asc" },
        { slotType: "asc" },
        { slotIndex: "asc" },
      ],
    });

    // For STORY_BATCH slots, also fetch story planning slots
    const storyWhereClause: any = {
      clerkId: user.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (profileId && profileId !== "all") {
      storyWhereClause.profileId = profileId;
    }
    const storySlots = await prisma.storyPlanningSlot.findMany({
      where: storyWhereClause,
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    });

    // For REEL_1 slots, also fetch reel planning slots
    const reelWhereClause: any = {
      clerkId: user.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (profileId && profileId !== "all") {
      reelWhereClause.profileId = profileId;
    }
    const reelSlots = await prisma.reelPlanningSlot.findMany({
      where: reelWhereClause,
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    });

    // For FEED_POST slots, also fetch feed post planning slots
    const feedPostWhereClause: any = {
      clerkId: user.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };
    if (profileId && profileId !== "all") {
      feedPostWhereClause.profileId = profileId;
    }
    const feedPostSlots = await prisma.feedPostPlanningSlot.findMany({
      where: feedPostWhereClause,
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    });

    // Group story slots by date
    const storySlotsGrouped = storySlots.reduce((acc, slot) => {
      // Format date as YYYY-MM-DD using the date components directly to avoid timezone issues
      const date = new Date(slot.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(slot);
      return acc;
    }, {} as Record<string, typeof storySlots>);

    // Group reel slots by date
    const reelSlotsGrouped = reelSlots.reduce((acc, slot) => {
      const date = new Date(slot.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(slot);
      return acc;
    }, {} as Record<string, typeof reelSlots>);

    // Group feed post slots by date
    const feedPostSlotsGrouped = feedPostSlots.reduce((acc, slot) => {
      const date = new Date(slot.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(slot);
      return acc;
    }, {} as Record<string, typeof feedPostSlots>);

    // Enhance slots with story count for STORY_BATCH
    const enhancedSlots = slots.map(slot => {
      if (slot.slotType === 'STORY_BATCH') {
        const date = new Date(slot.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        const storiesForDate = storySlotsGrouped[dateKey] || [];
        return {
          ...slot,
          storyCount: storiesForDate.length,
          postedCount: storiesForDate.filter(s => s.isPosted).length,
        };
      } else if (slot.slotType === 'REEL_1') {
        const date = new Date(slot.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        const reelsForDate = reelSlotsGrouped[dateKey] || [];
        return {
          ...slot,
          reelCount: reelsForDate.length,
          postedCount: reelsForDate.filter(r => r.isPosted).length,
        };
      }
      return slot;
    });

    // Convert grouped stories to simple count data for frontend
    const storyCountsByDate: Record<string, { total: number; posted: number }> = {};
    Object.entries(storySlotsGrouped).forEach(([dateKey, stories]) => {
      storyCountsByDate[dateKey] = {
        total: stories.length,
        posted: stories.filter(s => s.isPosted).length,
      };
    });

    // Convert grouped reels to simple count data for frontend
    const reelCountsByDate: Record<string, { total: number; posted: number }> = {};
    Object.entries(reelSlotsGrouped).forEach(([dateKey, reels]) => {
      reelCountsByDate[dateKey] = {
        total: reels.length,
        posted: reels.filter(r => r.isPosted).length,
      };
    });

    // Convert grouped feed posts to simple count data for frontend
    const feedPostCountsByDate: Record<string, { total: number; posted: number }> = {};
    Object.entries(feedPostSlotsGrouped).forEach(([dateKey, feedPosts]) => {
      feedPostCountsByDate[dateKey] = {
        total: feedPosts.length,
        posted: feedPosts.filter(fp => fp.isPosted).length,
      };
    });

    return NextResponse.json({ slots: enhancedSlots, storyCountsByDate, reelCountsByDate, feedPostCountsByDate });
  } catch (error) {
    console.error("Error fetching weekly slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly slots" },
      { status: 500 }
    );
  }
}

// POST: Create a new weekly planning slot
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      date,
      slotType,
      slotIndex = 0,
      status = "PLANNING",
      notes,
      hashtags,
      trendingAudio,
      contentIdeas,
      linkedPostId,
      profileId,
    } = body;

    if (!date || !slotType) {
      return NextResponse.json(
        { error: "date and slotType are required" },
        { status: 400 }
      );
    }

    // Check if slot already exists
    const existingSlot = await prisma.weeklyPlanningSlot.findUnique({
      where: {
        clerkId_date_slotType_slotIndex: {
          clerkId: user.id,
          date: new Date(date),
          slotType,
          slotIndex,
        },
      },
    });

    if (existingSlot) {
      return NextResponse.json(
        { error: "Slot already exists for this date and type" },
        { status: 409 }
      );
    }

    const slot = await prisma.weeklyPlanningSlot.create({
      data: {
        clerkId: user.id,
        profileId,
        date: new Date(date),
        slotType,
        slotIndex,
        status,
        notes,
        hashtags: hashtags || [],
        trendingAudio,
        contentIdeas,
        linkedPostId,
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
      },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    console.error("Error creating weekly slot:", error);
    return NextResponse.json(
      { error: "Failed to create weekly slot" },
      { status: 500 }
    );
  }
}
