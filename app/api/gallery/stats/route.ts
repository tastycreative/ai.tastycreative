import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Get aggregate statistics for gallery
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profileId") || searchParams.get("modelId");

    // Base where clause
    const where = profileId ? { profileId } : {};

    // Get overall aggregates
    const [
      totals,
      contentTypeStats,
      platformStats,
      topPerformers,
      recentItems,
      modelStats,
    ] = await Promise.all([
      // Total aggregates
      prisma.gallery_items.aggregate({
        where,
        _sum: {
          revenue: true,
          salesCount: true,
          viewCount: true,
        },
        _count: true,
        _avg: {
          revenue: true,
          conversionRate: true,
        },
      }),

      // Stats by content type
      prisma.gallery_items.groupBy({
        by: ["contentType"],
        where,
        _count: true,
        _sum: {
          revenue: true,
          salesCount: true,
        },
        orderBy: {
          _sum: {
            revenue: "desc",
          },
        },
        take: 10,
      }),

      // Stats by platform
      prisma.gallery_items.groupBy({
        by: ["platform"],
        where,
        _count: true,
        _sum: {
          revenue: true,
          salesCount: true,
        },
        orderBy: {
          _sum: {
            revenue: "desc",
          },
        },
      }),

      // Top performing items by revenue
      prisma.gallery_items.findMany({
        where: {
          ...where,
          revenue: { gt: 0 },
        },
        orderBy: { revenue: "desc" },
        take: 10,
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      }),

      // Recent items
      prisma.gallery_items.findMany({
        where,
        orderBy: { postedAt: "desc" },
        take: 5,
        include: {
          profile: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      // Stats by profile (top 10 by revenue)
      prisma.gallery_items.groupBy({
        by: ["profileId"],
        where: {
          ...where,
          profileId: { not: null },
        },
        _count: true,
        _sum: {
          revenue: true,
          salesCount: true,
        },
        orderBy: {
          _sum: {
            revenue: "desc",
          },
        },
        take: 10,
      }),
    ]);

    // Fetch profile details for profileStats
    const profileIds = modelStats
      .map((s) => s.profileId)
      .filter((id): id is string => id !== null);

    const profiles = await prisma.instagramProfile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    });

    const profileLookup = new Map(profiles.map((p) => [p.id, p]));

    // Format model stats with profile details
    const modelStatsWithDetails = modelStats.map((stat) => ({
      model: stat.profileId ? (() => {
        const p = profileLookup.get(stat.profileId);
        return p ? { id: p.id, name: p.name, displayName: p.name, profileImageUrl: p.profileImageUrl } : null;
      })() : null,
      count: stat._count,
      revenue: Number(stat._sum.revenue) || 0,
      salesCount: stat._sum.salesCount || 0,
    }));

    // Format content type stats
    const contentTypeStatsFormatted = contentTypeStats.map((stat) => ({
      contentType: stat.contentType,
      count: stat._count,
      revenue: Number(stat._sum.revenue) || 0,
      salesCount: stat._sum.salesCount || 0,
    }));

    // Format platform stats
    const platformStatsFormatted = platformStats.map((stat) => ({
      platform: stat.platform,
      count: stat._count,
      revenue: Number(stat._sum.revenue) || 0,
      salesCount: stat._sum.salesCount || 0,
    }));

    return NextResponse.json({
      data: {
        totals: {
          itemCount: totals._count,
          totalRevenue: Number(totals._sum.revenue) || 0,
          totalSales: totals._sum.salesCount || 0,
          totalViews: totals._sum.viewCount || 0,
          averageRevenue: Number(totals._avg.revenue) || 0,
          averageConversionRate: Number(totals._avg.conversionRate) || 0,
        },
        byContentType: contentTypeStatsFormatted,
        byPlatform: platformStatsFormatted,
        byModel: modelStatsWithDetails,
        topPerformers,
        recentItems,
      },
    });
  } catch (error) {
    console.error("Error fetching gallery stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery stats" },
      { status: 500 }
    );
  }
}
