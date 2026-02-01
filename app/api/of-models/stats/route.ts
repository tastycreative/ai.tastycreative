import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Get stats for all OF models (accessible by anyone authenticated)
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate date 30 days ago for "recent" models
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // High revenue threshold ($1000)
    const HIGH_REVENUE_THRESHOLD = 1000;

    // Get counts by status (all models, not user-specific)
    const [
      total,
      active,
      inactive,
      dropped,
      pending,
      recentModelsCount,
      highRevenueCount,
    ] = await Promise.all([
      prisma.of_models.count(),
      prisma.of_models.count({ where: { status: "ACTIVE" } }),
      prisma.of_models.count({ where: { status: "INACTIVE" } }),
      prisma.of_models.count({ where: { status: "DROPPED" } }),
      prisma.of_models.count({ where: { status: "PENDING" } }),
      // Count models launched in last 30 days
      prisma.of_models.count({
        where: {
          launchDate: { gte: thirtyDaysAgo },
        },
      }),
      // Count high-revenue models (guaranteed > threshold)
      prisma.of_models.count({
        where: {
          guaranteedAmount: { gt: HIGH_REVENUE_THRESHOLD },
        },
      }),
    ]);

    // Get recent models (for display)
    const recentModels = await prisma.of_models.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        slug: true,
        status: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    // Get total assets count
    const totalAssets = await prisma.of_model_assets.count();

    // Calculate total guaranteed revenue
    const revenueResult = await prisma.of_models.aggregate({
      _sum: {
        guaranteedAmount: true,
      },
      where: {
        guaranteedAmount: { not: null },
      },
    });
    const totalGuaranteedRevenue = revenueResult._sum.guaranteedAmount ?? 0;

    return NextResponse.json({
      data: {
        counts: {
          total,
          active,
          inactive,
          dropped,
          pending,
        },
        totalAssets,
        totalGuaranteedRevenue,
        recentModelsCount,
        highRevenueCount,
        recentModels,
      },
    });
  } catch (error) {
    console.error("Error fetching OF model stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
