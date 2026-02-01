import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Update performance metrics for a gallery item
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Check if item exists
    const existing = await prisma.gallery_items.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    // Extract performance fields
    const { revenue, salesCount, viewCount, conversionRate } = body;

    // Calculate conversion rate if not provided but we have sales and views
    let calculatedConversionRate = conversionRate;
    if (
      calculatedConversionRate === undefined &&
      viewCount !== undefined &&
      salesCount !== undefined &&
      viewCount > 0
    ) {
      calculatedConversionRate = (salesCount / viewCount) * 100;
    }

    const item = await prisma.gallery_items.update({
      where: { id },
      data: {
        ...(revenue !== undefined && { revenue }),
        ...(salesCount !== undefined && { salesCount }),
        ...(viewCount !== undefined && { viewCount }),
        ...(calculatedConversionRate !== undefined && {
          conversionRate: calculatedConversionRate,
        }),
      },
      include: {
        model: {
          select: {
            id: true,
            name: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error updating gallery item performance:", error);
    return NextResponse.json(
      { error: "Failed to update performance metrics" },
      { status: 500 }
    );
  }
}

// GET - Get performance metrics for a gallery item
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const item = await prisma.gallery_items.findUnique({
      where: { id },
      select: {
        id: true,
        revenue: true,
        salesCount: true,
        viewCount: true,
        conversionRate: true,
        pricingAmount: true,
        postedAt: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error fetching gallery item performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance metrics" },
      { status: 500 }
    );
  }
}
