import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all pricing categories for an OF model (accessible by anyone authenticated)
// Returns both model-specific and global categories
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeGlobal = searchParams.get("includeGlobal") !== "false"; // Default to true

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

    // Build where clause
    const whereClause = includeGlobal
      ? {
          OR: [
            { creatorId: id },
            { isGlobal: true },
          ],
        }
      : { creatorId: id };

    const categories = await prisma.of_model_pricing_categories.findMany({
      where: whereClause,
      orderBy: [
        { isGlobal: "asc" }, // Model-specific first, then global
        { order: "asc" },
      ],
      include: {
        of_model_pricing_items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error("Error fetching pricing categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing categories" },
      { status: 500 }
    );
  }
}

// POST - Create a new pricing category (accessible by anyone authenticated)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, slug, description, order = 0, isGlobal = false } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // For global categories, creatorId should be null
    // For model-specific, verify model exists
    if (!isGlobal) {
      const model = await prisma.of_models.findUnique({
        where: { id },
      });

      if (!model) {
        return NextResponse.json(
          { error: "OF model not found" },
          { status: 404 }
        );
      }
    }

    // Check if slug is unique for this creator (or globally if isGlobal)
    const existingCategory = await prisma.of_model_pricing_categories.findFirst({
      where: isGlobal
        ? { slug, isGlobal: true }
        : { creatorId: id, slug },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: isGlobal ? "Global category slug already exists" : "Category slug already exists for this model" },
        { status: 409 }
      );
    }

    const category = await prisma.of_model_pricing_categories.create({
      data: {
        creatorId: isGlobal ? null : id,
        name,
        slug,
        description,
        order,
        isGlobal,
        updatedAt: new Date(),
      },
      include: {
        of_model_pricing_items: true,
      },
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    console.error("Error creating pricing category:", error);
    return NextResponse.json(
      { error: "Failed to create pricing category" },
      { status: 500 }
    );
  }
}
