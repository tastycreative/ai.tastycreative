// app/api/instagram/performance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET: Fetch performance metrics for a date range
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

    const metrics = await prisma.performanceMetric.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance metrics" },
      { status: 500 }
    );
  }
}

// POST: Create or update performance metrics
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      date,
      profileId,
      reelsPosted,
      storiesPosted,
      feedPostsPosted,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      storyViews,
      storyReplies,
      followersStart,
      followersEnd,
      followersGained,
      followersLost,
    } = body;

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    // Calculate derived metrics
    const totalContent = (reelsPosted || 0) + (storiesPosted || 0) + (feedPostsPosted || 0);
    const averageViews = totalContent > 0 ? (totalViews || 0) / totalContent : 0;
    
    const totalEngagements = (totalLikes || 0) + (totalComments || 0) + (totalShares || 0);
    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

    // Upsert the metric
    const metric = await prisma.performanceMetric.upsert({
      where: {
        clerkId_date_profileId: {
          clerkId: user.id,
          date: new Date(date),
          profileId: profileId || "",
        },
      },
      update: {
        reelsPosted: reelsPosted ?? undefined,
        storiesPosted: storiesPosted ?? undefined,
        feedPostsPosted: feedPostsPosted ?? undefined,
        totalViews: totalViews ?? undefined,
        totalLikes: totalLikes ?? undefined,
        totalComments: totalComments ?? undefined,
        totalShares: totalShares ?? undefined,
        totalSaves: totalSaves ?? undefined,
        storyViews: storyViews ?? undefined,
        storyReplies: storyReplies ?? undefined,
        followersStart: followersStart ?? undefined,
        followersEnd: followersEnd ?? undefined,
        followersGained: followersGained ?? undefined,
        followersLost: followersLost ?? undefined,
        averageViews,
        engagementRate,
        updatedAt: new Date(),
      },
      create: {
        clerkId: user.id,
        profileId: profileId || "",
        date: new Date(date),
        reelsPosted: reelsPosted || 0,
        storiesPosted: storiesPosted || 0,
        feedPostsPosted: feedPostsPosted || 0,
        totalViews: totalViews || 0,
        totalLikes: totalLikes || 0,
        totalComments: totalComments || 0,
        totalShares: totalShares || 0,
        totalSaves: totalSaves || 0,
        storyViews: storyViews || 0,
        storyReplies: storyReplies || 0,
        followersStart: followersStart || 0,
        followersEnd: followersEnd || 0,
        followersGained: followersGained || 0,
        followersLost: followersLost || 0,
        averageViews,
        engagementRate,
      },
    });

    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    console.error("Error creating/updating performance metric:", error);
    return NextResponse.json(
      { error: "Failed to save performance metric" },
      { status: 500 }
    );
  }
}
