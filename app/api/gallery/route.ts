import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { Prisma } from "@/lib/generated/prisma";
import type { GalleryFilters, GallerySortField } from "@/types/gallery";

// GET - List gallery items with filters and pagination
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "24");
    const skip = (page - 1) * pageSize;

    // Filters
    const modelId = searchParams.get("modelId");
    const contentType = searchParams.get("contentType");
    const platform = searchParams.get("platform");
    const isArchived = searchParams.get("isArchived");
    const search = searchParams.get("search");
    const postedAfter = searchParams.get("postedAfter");
    const postedBefore = searchParams.get("postedBefore");
    const minRevenue = searchParams.get("minRevenue");
    const maxRevenue = searchParams.get("maxRevenue");
    const tags = searchParams.get("tags");

    // Sorting
    const sortField = (searchParams.get("sortField") ||
      "postedAt") as GallerySortField;
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      | "asc"
      | "desc";

    // Include summary stats
    const includeSummary = searchParams.get("includeSummary") === "true";

    // Build where clause
    const where: Prisma.gallery_itemsWhereInput = {
      ...(modelId && { modelId }),
      ...(contentType && contentType !== "all" && { contentType }),
      ...(platform && platform !== "all" && { platform }),
      ...(isArchived !== null &&
        isArchived !== undefined && {
          isArchived: isArchived === "true",
        }),
      ...(postedAfter && { postedAt: { gte: new Date(postedAfter) } }),
      ...(postedBefore && { postedAt: { lte: new Date(postedBefore) } }),
      ...(minRevenue && { revenue: { gte: parseFloat(minRevenue) } }),
      ...(maxRevenue && { revenue: { lte: parseFloat(maxRevenue) } }),
      ...(tags && { tags: { hasSome: tags.split(",") } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { captionUsed: { contains: search, mode: "insensitive" as const } },
          { tags: { hasSome: [search.toLowerCase()] } },
        ],
      }),
    };

    // Build orderBy
    const orderBy: Prisma.gallery_itemsOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    // Execute queries
    const [items, total] = await Promise.all([
      prisma.gallery_items.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
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
      }),
      prisma.gallery_items.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    // Build response
    const response: {
      items: typeof items;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
      summary?: {
        totalItems: number;
        totalRevenue: number;
        totalSales: number;
        totalViews: number;
      };
    } = {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };

    // Include summary if requested
    if (includeSummary) {
      const aggregates = await prisma.gallery_items.aggregate({
        where,
        _sum: {
          revenue: true,
          salesCount: true,
          viewCount: true,
        },
        _count: true,
      });

      response.summary = {
        totalItems: aggregates._count,
        totalRevenue: Number(aggregates._sum.revenue) || 0,
        totalSales: aggregates._sum.salesCount || 0,
        totalViews: aggregates._sum.viewCount || 0,
      };
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Error fetching gallery items:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery items" },
      { status: 500 }
    );
  }
}

// POST - Create a new gallery item
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      previewUrl,
      thumbnailUrl,
      originalAssetUrl,
      title,
      contentType,
      tags = [],
      platform,
      pricingAmount,
      modelId,
      captionUsed,
      revenue = 0,
      salesCount = 0,
      viewCount = 0,
      postedAt,
      origin = "manual",
    } = body;

    // Validate required fields
    if (!previewUrl || !contentType || !platform || !postedAt) {
      return NextResponse.json(
        {
          error:
            "previewUrl, contentType, platform, and postedAt are required",
        },
        { status: 400 }
      );
    }

    // Validate modelId if provided
    if (modelId) {
      const model = await prisma.of_models.findUnique({
        where: { id: modelId },
      });
      if (!model) {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
    }

    const item = await prisma.gallery_items.create({
      data: {
        previewUrl,
        thumbnailUrl,
        originalAssetUrl,
        title,
        contentType,
        tags,
        platform,
        pricingAmount,
        modelId,
        captionUsed,
        revenue,
        salesCount,
        viewCount,
        postedAt: new Date(postedAt),
        origin,
        createdBy: userId,
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

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating gallery item:", error);
    return NextResponse.json(
      { error: "Failed to create gallery item" },
      { status: 500 }
    );
  }
}
