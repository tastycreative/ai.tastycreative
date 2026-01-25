import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single OF model by ID or slug (accessible by anyone authenticated)
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Try to find by ID first, then by slug
    const model = await prisma.of_models.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: ({
        pricingCategories: {
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
            },
          },
        },
      } as any),
    });

    if (!model) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: model });
  } catch (error) {
    console.error("Error fetching OF model:", error);
    return NextResponse.json(
      { error: "Failed to fetch OF model" },
      { status: 500 }
    );
  }
}

// PATCH - Update an OF model (accessible by anyone authenticated)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify model exists
    const existingModel = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!existingModel) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // If slug is being updated, check for conflicts
    if (body.slug && body.slug !== existingModel.slug) {
      const slugExists = await prisma.of_models.findUnique({
        where: { slug: body.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "Slug is already taken" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = [
      "name",
      "displayName",
      "slug",
      "status",
      "profileImageUrl",
      "bio",
      "personalityType",
      "commonTerms",
      "commonEmojis",
      "restrictedTerms",
      "notes",
      "percentageTaken",
      "guaranteedAmount",
      "launchDate",
      "instagramUrl",
      "twitterUrl",
      "tiktokUrl",
      "websiteUrl",
      "profileLinkUrl",
      "referrerName",
      "chattingManagers",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "status") {
          updateData[field] = body[field].toUpperCase();
        } else if (field === "launchDate") {
          updateData[field] = body[field] ? new Date(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }


    const model = await prisma.of_models.update({
      where: { id },
      data: updateData,
      include: ({
        _count: {
          select: {
            assets: true,
            pricingCategories: true,
          },
        },
      } as any),
    });

    return NextResponse.json({ data: model });
  } catch (error) {
    console.error("Error updating OF model:", error);
    return NextResponse.json(
      { error: "Failed to update OF model" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an OF model (accessible by anyone authenticated)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify model exists
    const existingModel = await prisma.of_models.findUnique({
      where: { id },
    });

    if (!existingModel) {
      return NextResponse.json(
        { error: "OF model not found" },
        { status: 404 }
      );
    }

    // Delete the model (cascades to details, assets, pricing)
    await prisma.of_models.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting OF model:", error);
    return NextResponse.json(
      { error: "Failed to delete OF model" },
      { status: 500 }
    );
  }
}
