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

    // Get counts by status (all models, not user-specific)
    const [total, active, inactive, dropped, pending] = await Promise.all([
      prisma.of_models.count(),
      prisma.of_models.count({ where: { status: "ACTIVE" } }),
      prisma.of_models.count({ where: { status: "INACTIVE" } }),
      prisma.of_models.count({ where: { status: "DROPPED" } }),
      prisma.of_models.count({ where: { status: "PENDING" } }),
    ]);

    // Get recent models
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
