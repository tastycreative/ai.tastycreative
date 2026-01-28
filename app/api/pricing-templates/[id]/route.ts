import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for updating a pricing template
const updateTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only").optional(),
  description: z.string().optional().nullable(),
  category: z.enum(["PORN_ACCURATE", "PORN_SCAM", "GF_ACCURATE", "GF_SCAM", "BUNDLE_BASED", "CUSTOM"]).optional(),
  pageType: z.enum(["ALL_PAGES", "FREE", "PAID", "VIP"]).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET - Get a single pricing template by ID
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const template = await prisma.pricing_template.findUnique({
      where: { id },
      include: {
        items: {
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

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error("Error fetching pricing template:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing template" },
      { status: 500 }
    );
  }
}

// PATCH - Update a pricing template
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateTemplateSchema.parse(body);

    // Check if template exists
    const existingTemplate = await prisma.pricing_template.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    // If slug is being updated, check for conflicts
    if (validatedData.slug && validatedData.slug !== existingTemplate.slug) {
      const slugExists = await prisma.pricing_template.findUnique({
        where: { slug: validatedData.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "A template with this slug already exists" },
          { status: 409 }
        );
      }
    }

    const template = await prisma.pricing_template.update({
      where: { id },
      data: validatedData,
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating pricing template:", error);
    return NextResponse.json(
      { error: "Failed to update pricing template" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pricing template (soft delete via isActive)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hardDelete = searchParams.get("hard") === "true";

    // Check if template exists
    const existingTemplate = await prisma.pricing_template.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Pricing template not found" },
        { status: 404 }
      );
    }

    // Prevent deleting system default templates
    if (existingTemplate.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete system default templates" },
        { status: 403 }
      );
    }

    if (hardDelete) {
      // Hard delete - removes the template and all items
      await prisma.pricing_template.delete({
        where: { id },
      });
    } else {
      // Soft delete - set isActive to false
      await prisma.pricing_template.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pricing template:", error);
    return NextResponse.json(
      { error: "Failed to delete pricing template" },
      { status: 500 }
    );
  }
}
