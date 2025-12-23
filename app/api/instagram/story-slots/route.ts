// app/api/instagram/story-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

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

    return NextResponse.json({ slots });
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

    // Parse timeSlot as DateTime (expects ISO string or date string)
    const timeSlotDate = new Date(timeSlot);

    // Generate unique content ID for future pipeline tracking
    const storyDate = new Date(date);
    const year = storyDate.getFullYear();
    const month = String(storyDate.getMonth() + 1).padStart(2, '0');
    const day = String(storyDate.getDate()).padStart(2, '0');
    
    // Count existing stories for this day to generate sequence number
    const existingStoriesCount = await prisma.storyPlanningSlot.count({
      where: {
        clerkId: user.id,
        date: storyDate,
      },
    });
    
    const contentId = `STORY-${year}${month}${day}-${String(existingStoriesCount + 1).padStart(3, '0')}`;

    // Check if a slot already exists for this time
    const existingSlot = await prisma.storyPlanningSlot.findUnique({
      where: {
        clerkId_profileId_timeSlot: {
          clerkId: user.id,
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
        clerkId: user.id,
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
