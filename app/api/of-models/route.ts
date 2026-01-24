import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { Prisma } from "@/lib/generated/prisma";

// GET - List all OF models (accessible by anyone authenticated)
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");
    const sort = searchParams.get("sort") || "createdAt";
    const sortDirection = searchParams.get("sortDirection") || "desc";

    // Build where clause (no user filtering - accessible by all)
    const where: Prisma.OfModelWhereInput = {
      ...(status && status !== "all" && { status: status.toUpperCase() as any }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { displayName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    // Build orderBy
    const orderBy: Prisma.OfModelOrderByWithRelationInput = {
      [sort]: sortDirection as "asc" | "desc",
    };

    const models = await prisma.ofModel.findMany({
      where,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy,
      include: {
        details: true,
        _count: {
          select: {
            assets: true,
            pricingCategories: true,
          },
        },
      },
    });

    const hasMore = models.length > limit;
    const items = hasMore ? models.slice(0, limit) : models;

    return NextResponse.json({
      data: items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Error fetching OF models:", error);
    return NextResponse.json(
      { error: "Failed to fetch OF models" },
      { status: 500 }
    );
  }
}

// POST - Create a new OF model
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      displayName,
      slug,
      status = "ACTIVE",
      profileImageUrl,
      bio,
      personalityType,
      commonTerms = [],
      commonEmojis = [],
      restrictedTerms = [],
      notes,
      percentageTaken,
      guaranteedAmount,
      launchDate,
      instagramUrl,
      twitterUrl,
      tiktokUrl,
      websiteUrl,
      profileLinkUrl,
      referrerName,
      chattingManagers = [],
    } = body;

    // Validate required fields
    if (!name || !displayName || !slug) {
      return NextResponse.json(
        { error: "Name, displayName, and slug are required" },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingModel = await prisma.ofModel.findUnique({
      where: { slug },
    });

    if (existingModel) {
      return NextResponse.json(
        { error: "Slug is already taken" },
        { status: 409 }
      );
    }

    const model = await prisma.ofModel.create({
      data: {
        name,
        displayName,
        slug,
        status: status.toUpperCase(),
        profileImageUrl,
        bio,
        personalityType,
        commonTerms,
        commonEmojis,
        restrictedTerms,
        notes,
        percentageTaken,
        guaranteedAmount,
        launchDate: launchDate ? new Date(launchDate) : null,
        instagramUrl,
        twitterUrl,
        tiktokUrl,
        websiteUrl,
        profileLinkUrl,
        referrerName,
        chattingManagers,
        createdBy: userId, // Track who created it
      },
      include: {
        details: true,
        _count: {
          select: {
            assets: true,
            pricingCategories: true,
          },
        },
      },
    });

    return NextResponse.json({ data: model }, { status: 201 });
  } catch (error) {
    console.error("Error creating OF model:", error);
    return NextResponse.json(
      { error: "Failed to create OF model" },
      { status: 500 }
    );
  }
}
