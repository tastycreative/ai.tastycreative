import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all pricing categories for an OF model (accessible by anyone authenticated)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    const categories = await prisma.of_model_pricing_categories.findMany({
      where: { creatorId: id },
      orderBy: { order: "asc" },
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
    const { name, slug, description, order = 0 } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

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

    // Check if slug is unique for this creator
    const existingCategory = await prisma.of_model_pricing_categories.findUnique({
      where: {
        creatorId_slug: {
          creatorId: id,
          slug,
        },
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "Category slug already exists for this model" },
        { status: 409 }
      );
    }

    const category = await prisma.of_model_pricing_categories.create({
      data: {
        creatorId: id,
        name,
        slug,
        description,
        order,
      } as any,
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
