import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for creating a pricing template item
const createItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  priceType: z.enum(["FIXED", "RANGE", "MINIMUM"]).default("FIXED"),
  priceFixed: z.number().optional().nullable(),
  priceMin: z.number().optional().nullable(),
  priceMax: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  order: z.number().optional(),
  isActive: z.boolean().default(true),
});

// Schema for updating a pricing template item
const updateItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  name: z.string().min(1, "Item name is required").optional(),
  priceType: z.enum(["FIXED", "RANGE", "MINIMUM"]).optional(),
  priceFixed: z.number().optional().nullable(),
  priceMin: z.number().optional().nullable(),
  priceMax: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

// Schema for bulk reorder
const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    order: z.number(),
  })),
});

// GET - List all items in a pricing template
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;

    // Verify template exists
    const template = await prisma.pricing_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const items = await prisma.pricing_template_item.findMany({
      where: {
        templateId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching pricing template items:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing template items" },
      { status: 500 }
    );
  }
}

// POST - Add an item to a pricing template
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;
    const body = await req.json();
    const validatedData = createItemSchema.parse(body);

    // Verify template exists
    const template = await prisma.pricing_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    // Get the max order in this template
    const maxOrder = await prisma.pricing_template_item.aggregate({
      where: { templateId },
      _max: { order: true },
    });

    const item = await prisma.pricing_template_item.create({
      data: {
        templateId,
        name: validatedData.name,
        priceType: validatedData.priceType,
        priceFixed: validatedData.priceFixed,
        priceMin: validatedData.priceMin,
        priceMax: validatedData.priceMax,
        description: validatedData.description,
        order: validatedData.order ?? (maxOrder._max.order ?? 0) + 1,
        isActive: validatedData.isActive,
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating pricing template item:", error);
    return NextResponse.json(
      { error: "Failed to create pricing template item" },
      { status: 500 }
    );
  }
}

// PATCH - Update an item or bulk reorder items
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;
    const body = await req.json();

    // Verify template exists
    const template = await prisma.pricing_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    // Check if this is a bulk reorder operation
    if (body.items && Array.isArray(body.items)) {
      const validatedData = reorderSchema.parse(body);

      await prisma.$transaction(
        validatedData.items.map((item) =>
          prisma.pricing_template_item.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );

      const items = await prisma.pricing_template_item.findMany({
        where: { templateId },
        orderBy: { order: "asc" },
      });

      return NextResponse.json({ data: items });
    }

    // Single item update
    const validatedData = updateItemSchema.parse(body);

    // Verify item exists and belongs to this template
    const existingItem = await prisma.pricing_template_item.findUnique({
      where: { id: validatedData.itemId },
    });

    if (!existingItem || existingItem.templateId !== templateId) {
      return NextResponse.json(
        { error: "Item not found in this template" },
        { status: 404 }
      );
    }

    const { itemId, ...updateData } = validatedData;
    const item = await prisma.pricing_template_item.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating pricing template item:", error);
    return NextResponse.json(
      { error: "Failed to update pricing template item" },
      { status: 500 }
    );
  }
}

// DELETE - Remove an item from a pricing template
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: templateId } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    // Verify template exists
    const template = await prisma.pricing_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    // Verify item exists and belongs to this template
    const existingItem = await prisma.pricing_template_item.findUnique({
      where: { id: itemId },
    });

    if (!existingItem || existingItem.templateId !== templateId) {
      return NextResponse.json(
        { error: "Item not found in this template" },
        { status: 404 }
      );
    }

    await prisma.pricing_template_item.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing template item:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing template item" },
      { status: 500 }
    );
  }
}
