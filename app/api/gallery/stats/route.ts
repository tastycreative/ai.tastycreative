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
    const modelId = searchParams.get("modelId");

    // Base where clause
    const where = modelId ? { modelId } : {};

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
          of_models: {
            select: {
              id: true,
              name: true,
              displayName: true,
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
          of_models: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      }),

      // Stats by model (top 10 by revenue)
      prisma.gallery_items.groupBy({
        by: ["modelId"],
        where: {
          ...where,
          modelId: { not: null },
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

    // Fetch model details for modelStats
    const modelIds = modelStats
      .map((s) => s.modelId)
      .filter((id): id is string => id !== null);

    const models = await prisma.of_models.findMany({
      where: { id: { in: modelIds } },
      select: {
        id: true,
        name: true,
        displayName: true,
        profileImageUrl: true,
      },
    });

    const modelLookup = new Map(models.map((m) => [m.id, m]));

    // Format model stats with model details
    const modelStatsWithDetails = modelStats.map((stat) => ({
      model: stat.modelId ? modelLookup.get(stat.modelId) : null,
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
