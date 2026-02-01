// app/api/instagram/performance/route.ts
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

    const isAllProfiles = !profileId || profileId === "all";

    // Get all accessible profile IDs (own + shared)
    const accessibleProfileIds = await getAccessibleProfileIds(user.id);

    // Build profile map for all accessible profiles
    const allProfiles = await prisma.instagramProfile.findMany({
      where: { id: { in: accessibleProfileIds } },
      select: { id: true, name: true, clerkId: true },
    });
    const profileMap = allProfiles.reduce((acc, profile) => {
      acc[profile.id] = profile.name;
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

    const metrics = await prisma.performanceMetric.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
    });

    // Add profileName to each metric
    const metricsWithProfile = metrics.map((metric) => ({
      ...metric,
      profileName: profileMap[metric.profileId] || "Unknown Profile",
    }));

    return NextResponse.json({ metrics: metricsWithProfile });
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

    // Calculate derived metrics
    const totalContent = (reelsPosted || 0) + (storiesPosted || 0) + (feedPostsPosted || 0);
    const averageViews = totalContent > 0 ? (totalViews || 0) / totalContent : 0;
    
    const totalEngagements = (totalLikes || 0) + (totalComments || 0) + (totalShares || 0);
    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

    // Upsert the metric
    const metric = await prisma.performanceMetric.upsert({
      where: {
        clerkId_date_profileId: {
          clerkId: targetClerkId,
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
        clerkId: targetClerkId,
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
