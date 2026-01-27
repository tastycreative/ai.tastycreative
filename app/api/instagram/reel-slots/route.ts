// app/api/instagram/reel-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { PrismaClient } from "@/lib/generated/prisma";

const prisma = new PrismaClient();

// GET: Fetch reel slots for a date range
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

    const whereClause: any = {
      clerkId: user.id,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (!isAllProfiles) {
      whereClause.profileId = profileId;
    }

    const slots = await prisma.reelPlanningSlot.findMany({
      where: whereClause,
      include: {
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

    // Add profileName to each slot when in "all profiles" mode
    const slotsWithProfileName = slots.map((slot) => ({
      ...slot,
      profileName: isAllProfiles && slot.profileId ? profileMap[slot.profileId] || "Unknown" : undefined,
    }));

    return NextResponse.json({ slots: slotsWithProfileName });
  } catch (error) {
    console.error("Error fetching reel slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch reel slots" },
      { status: 500 }
    );
  }
}

// POST: Create a new reel slot
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
      reelType,
      hookIdea,
      trendingAudio,
      notes,
      caption,
      hashtags,
      profileId,
      awsS3Key,
      awsS3Url,
      fileName,
      mimeType,
    } = body;

    if (!date || !timeSlot || !reelType) {
      return NextResponse.json(
        { error: "date, timeSlot, and reelType are required" },
        { status: 400 }
      );
    }

    // Parse timeSlot as DateTime
    const timeSlotDate = new Date(timeSlot);

    // Generate unique content ID
    const reelDate = new Date(date);
    const year = reelDate.getFullYear();
    const month = String(reelDate.getMonth() + 1).padStart(2, '0');
    const day = String(reelDate.getDate()).padStart(2, '0');
    
    // Count existing reels for this day to generate sequence number
    const existingReelsCount = await prisma.reelPlanningSlot.count({
      where: {
        clerkId: user.id,
        date: reelDate,
      },
    });
    
    const contentId = `REEL-${year}${month}${day}-${String(existingReelsCount + 1).padStart(3, '0')}`;

    // Create reel slot
    const slot = await prisma.reelPlanningSlot.create({
      data: {
        clerkId: user.id,
        profileId,
        contentId,
        pipelineItemId: null,
        date: reelDate,
        timeSlot: timeSlotDate,
        reelType,
        hookIdea,
        trendingAudio,
        notes,
        caption,
        hashtags: hashtags || [],
        awsS3Key,
        awsS3Url,
        fileName,
        mimeType,
      },
      include: {
        pipelineItem: true,
      },
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    console.error("Error creating reel slot:", error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint failed')) {
      return NextResponse.json(
        { error: "A reel is already planned for this time slot!" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create reel slot" },
      { status: 500 }
    );
  }
}
