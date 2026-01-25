import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string; categoryId: string }>;
}

// GET - Get a single pricing category (accessible by anyone authenticated)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId } = await params;

    // Verify model exists
    const model = await prisma.ofModel.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    const category = await prisma.ofModelPricingCategory.findFirst({
      where: {
        id: categoryId,
        creatorId: id,
      },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: category });
  } catch (error) {
    console.error("Error fetching pricing category:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing category" },
      { status: 500 }
    );
  }
}

// PATCH - Update a pricing category (accessible by anyone authenticated)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId } = await params;
    const body = await req.json();

    // Verify model exists
    const model = await prisma.ofModel.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Verify category exists
    const existingCategory = await prisma.ofModelPricingCategory.findFirst({
      where: {
        id: categoryId,
        creatorId: id,
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    // If slug is being updated, check for conflicts
    if (body.slug && body.slug !== existingCategory.slug) {
      const slugExists = await prisma.ofModelPricingCategory.findUnique({
        where: {
          creatorId_slug: {
            creatorId: id,
            slug: body.slug,
          },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "Category slug already exists for this model" },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.order !== undefined) updateData.order = body.order;

    const category = await prisma.ofModelPricingCategory.update({
      where: { id: categoryId },
      data: updateData,
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ data: category });
  } catch (error) {
    console.error("Error updating pricing category:", error);
    return NextResponse.json(
      { error: "Failed to update pricing category" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pricing category (accessible by anyone authenticated)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId } = await params;

    // Verify model exists
    const model = await prisma.ofModel.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Verify category exists
    const existingCategory = await prisma.ofModelPricingCategory.findFirst({
      where: {
        id: categoryId,
        creatorId: id,
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    // Delete category (cascades to items)
    await prisma.ofModelPricingCategory.delete({
      where: { id: categoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing category:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing category" },
      { status: 500 }
    );
  }
}
