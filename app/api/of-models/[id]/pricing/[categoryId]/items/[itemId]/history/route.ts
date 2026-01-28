import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string; categoryId: string; itemId: string }>;
}

// GET - Get pricing history for a specific item
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId, itemId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Verify model exists
    const model = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Verify item exists
    const item = await prisma.of_model_pricing_items.findFirst({
      where: {
        id: itemId,
        categoryId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Pricing item not found" },
        { status: 404 }
      );
    }

    const [history, total] = await Promise.all([
      prisma.pricing_history.findMany({
        where: { pricingItemId: itemId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.pricing_history.count({
        where: { pricingItemId: itemId },
      }),
    ]);

    return NextResponse.json({
      data: history,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + history.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching pricing history:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing history" },
      { status: 500 }
    );
  }
}
