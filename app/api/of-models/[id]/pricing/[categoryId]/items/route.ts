import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string; categoryId: string }>;
}

// GET - Get all items in a pricing category (accessible by anyone authenticated)
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

    // Verify category exists
    const category = await prisma.ofModelPricingCategory.findFirst({
      where: {
        id: categoryId,
        creatorId: id,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    const items = await prisma.ofModelPricingItem.findMany({
      where: { categoryId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching pricing items:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing items" },
      { status: 500 }
    );
  }
}

// POST - Create a new pricing item (accessible by anyone authenticated)
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId } = await params;
    const body = await req.json();
    const { name, price, description, order = 0, isActive = true } = body;

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

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
    const category = await prisma.ofModelPricingCategory.findFirst({
      where: {
        id: categoryId,
        creatorId: id,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    const item = await prisma.ofModelPricingItem.create({
      data: {
        categoryId,
        name,
        price: parseFloat(price),
        description,
        order,
        isActive,
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating pricing item:", error);
    return NextResponse.json(
      { error: "Failed to create pricing item" },
      { status: 500 }
    );
  }
}

// PATCH - Update a pricing item (accessible by anyone authenticated)
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
    const category = await prisma.ofModelPricingCategory.findFirst({
      where: {
        id: categoryId,
        creatorId: id,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Pricing category not found" },
        { status: 404 }
      );
    }

    // Handle single item update
    if (body.itemId) {
      const { itemId, ...updateData } = body;

      const existingItem = await prisma.ofModelPricingItem.findFirst({
        where: {
          id: itemId,
          categoryId,
        },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: "Pricing item not found" },
          { status: 404 }
        );
      }

      const data: any = {};
      if (updateData.name !== undefined) data.name = updateData.name;
      if (updateData.price !== undefined) data.price = parseFloat(updateData.price);
      if (updateData.description !== undefined) data.description = updateData.description;
      if (updateData.order !== undefined) data.order = updateData.order;
      if (updateData.isActive !== undefined) data.isActive = updateData.isActive;

      const item = await prisma.ofModelPricingItem.update({
        where: { id: itemId },
        data,
      });

      return NextResponse.json({ data: item });
    }

    // Handle bulk order update
    if (body.items && Array.isArray(body.items)) {
      const updates = body.items.map((item: { id: string; order: number }) =>
        prisma.ofModelPricingItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      );

      await Promise.all(updates);

      const items = await prisma.ofModelPricingItem.findMany({
        where: { categoryId },
        orderBy: { order: "asc" },
      });

      return NextResponse.json({ data: items });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating pricing item:", error);
    return NextResponse.json(
      { error: "Failed to update pricing item" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pricing item (accessible by anyone authenticated)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, categoryId } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

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

    // Verify item exists and belongs to category
    const existingItem = await prisma.ofModelPricingItem.findFirst({
      where: {
        id: itemId,
        categoryId,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: "Pricing item not found" },
        { status: 404 }
      );
    }

    await prisma.ofModelPricingItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing item:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing item" },
      { status: 500 }
    );
  }
}
