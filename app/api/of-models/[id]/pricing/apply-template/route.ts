import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for applying a pricing template
const applyTemplateSchema = z.object({
  templateId: z.string().min(1, "Template ID is required"),
  mode: z.enum(["replace", "merge"]).default("replace"),
});

// POST - Apply a pricing template to an OF model
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: modelId } = await params;
    const body = await req.json();
    const validatedData = applyTemplateSchema.parse(body);

    // Verify OF model exists
    const model = await prisma.of_models.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Fetch the template with all its items
    const template = await prisma.pricing_template.findUnique({
      where: { id: validatedData.templateId },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { error: "Cannot apply an inactive template" },
        { status: 400 }
      );
    }

    // Group template items by using the template name as the category
    // The template name becomes the category name
    const categoryName = template.name;
    const categorySlug = template.slug;

    await prisma.$transaction(async (tx) => {
      if (validatedData.mode === "replace") {
        // Delete all existing pricing categories and items for this model
        await tx.of_model_pricing_categories.deleteMany({
          where: { creatorId: modelId },
        });
      }

      // Check if category with this slug already exists (for merge mode)
      let existingCategory = null;
      if (validatedData.mode === "merge") {
        existingCategory = await tx.of_model_pricing_categories.findUnique({
          where: {
            creatorId_slug: {
              creatorId: modelId,
              slug: categorySlug,
            },
          },
        });
      }

      // Get current max order for categories
      const maxCategoryOrder = await tx.of_model_pricing_categories.aggregate({
        where: { creatorId: modelId },
        _max: { order: true },
      });

      let category;
      if (existingCategory) {
        // Use existing category
        category = existingCategory;
      } else {
        // Create new category
        category = await tx.of_model_pricing_categories.create({
          data: {
            creatorId: modelId,
            name: categoryName,
            slug: categorySlug,
            description: template.description,
            order: (maxCategoryOrder._max.order ?? -1) + 1,
          } as any,
        });
      }

      // Get current max order for items in this category
      const maxItemOrder = await tx.of_model_pricing_items.aggregate({
        where: { categoryId: category.id },
        _max: { order: true },
      });

      const startingOrder = (maxItemOrder._max.order ?? -1) + 1;

      // Create pricing items from template
      if (template.items.length > 0) {
        await tx.of_model_pricing_items.createMany({
          data: template.items.map((item, index) => ({
            categoryId: category.id,
            name: item.name,
            // Determine main price based on price type and isFree
            price: item.isFree ? 0 : (item.priceFixed ?? item.priceMin ?? 0),
            priceType: item.isFree ? "FIXED" : item.priceType,
            priceMin: item.isFree ? null : item.priceMin,
            priceMax: item.isFree ? null : item.priceMax,
            isFree: item.isFree,
            description: item.description,
            order: startingOrder + index,
            isActive: item.isActive,
            updatedAt: new Date(),
          })),
        });
      }
    });

    // Fetch updated pricing data
    const updatedCategories = await prisma.of_model_pricing_categories.findMany({
      where: { creatorId: modelId },
      orderBy: { order: "asc" },
      include: {
        of_model_pricing_items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({
      data: updatedCategories,
      message: `Template "${template.name}" applied successfully (${validatedData.mode} mode)`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error applying pricing template:", error);
    return NextResponse.json(
      { error: "Failed to apply pricing template" },
      { status: 500 }
    );
  }
}
