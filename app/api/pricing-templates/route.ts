import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { z } from "zod";

// Schema for creating a pricing template
const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().optional().nullable(),
  category: z.enum(["PORN_ACCURATE", "PORN_SCAM", "GF_ACCURATE", "GF_SCAM", "BUNDLE_BASED", "CUSTOM"]),
  pageType: z.enum(["ALL_PAGES", "FREE", "PAID", "VIP"]).default("ALL_PAGES"),
  isDefault: z.boolean().default(false),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    priceType: z.enum(["FIXED", "RANGE", "MINIMUM"]).default("FIXED"),
    priceFixed: z.number().optional().nullable(),
    priceMin: z.number().optional().nullable(),
    priceMax: z.number().optional().nullable(),
    isFree: z.boolean().default(false),
    description: z.string().optional().nullable(),
    order: z.number().default(0),
    isActive: z.boolean().default(true),
  })).optional(),
});

// GET - List all pricing templates
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const pageType = searchParams.get("pageType");
    const includeItems = searchParams.get("includeItems") === "true";
    const activeOnly = searchParams.get("activeOnly") !== "false"; // Default to true

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (pageType) {
      where.pageType = pageType;
    }

    if (activeOnly) {
      where.isActive = true;
    }

    const templates = await prisma.pricing_template.findMany({
      where,
      include: includeItems ? {
        items: {
          where: activeOnly ? { isActive: true } : undefined,
          orderBy: { order: "asc" },
        },
      } : undefined,
      orderBy: [
        { isDefault: "desc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("Error fetching pricing templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing templates" },
      { status: 500 }
    );
  }
}

// POST - Create a new pricing template
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createTemplateSchema.parse(body);

    // Check if slug already exists
    const existingTemplate = await prisma.pricing_template.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { error: "A template with this slug already exists" },
        { status: 409 }
      );
    }

    // Create template with items in a transaction
    const template = await prisma.$transaction(async (tx) => {
      const newTemplate = await tx.pricing_template.create({
        data: {
          name: validatedData.name,
          slug: validatedData.slug,
          description: validatedData.description,
          category: validatedData.category,
          pageType: validatedData.pageType,
          isDefault: validatedData.isDefault,
          createdBy: userId,
        },
      });

      // Create items if provided
      if (validatedData.items && validatedData.items.length > 0) {
        await tx.pricing_template_item.createMany({
          data: validatedData.items.map((item, index) => ({
            templateId: newTemplate.id,
            name: item.name,
            priceType: item.isFree ? "FIXED" : item.priceType,
            priceFixed: item.isFree ? null : item.priceFixed,
            priceMin: item.isFree ? null : item.priceMin,
            priceMax: item.isFree ? null : item.priceMax,
            isFree: item.isFree ?? false,
            description: item.description,
            order: item.order ?? index,
            isActive: item.isActive ?? true,
          })),
        });
      }

      // Return template with items
      return tx.pricing_template.findUnique({
        where: { id: newTemplate.id },
        include: {
          items: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating pricing template:", error);
    return NextResponse.json(
      { error: "Failed to create pricing template" },
      { status: 500 }
    );
  }
}
