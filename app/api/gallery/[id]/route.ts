import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single gallery item
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const item = await prisma.gallery_items.findUnique({
      where: { id },
      include: {
        of_models: {
          select: {
            id: true,
            name: true,
            displayName: true,
            profileImageUrl: true,
            slug: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error fetching gallery item:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery item" },
      { status: 500 }
    );
  }
}

// PATCH - Update a gallery item
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Check if item exists
    const existing = await prisma.gallery_items.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    // Extract updatable fields
    const {
      previewUrl,
      thumbnailUrl,
      originalAssetUrl,
      title,
      contentType,
      tags,
      platform,
      pricingAmount,
      modelId,
      captionUsed,
      postedAt,
      isArchived,
    } = body;

    // Validate modelId if provided
    if (modelId) {
      const model = await prisma.of_models.findUnique({
        where: { id: modelId },
      });
      if (!model) {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
    }

    const item = await prisma.gallery_items.update({
      where: { id },
      data: {
        ...(previewUrl !== undefined && { previewUrl }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(originalAssetUrl !== undefined && { originalAssetUrl }),
        ...(title !== undefined && { title }),
        ...(contentType !== undefined && { contentType }),
        ...(tags !== undefined && { tags }),
        ...(platform !== undefined && { platform }),
        ...(pricingAmount !== undefined && { pricingAmount }),
        ...(modelId !== undefined && { modelId }),
        ...(captionUsed !== undefined && { captionUsed }),
        ...(postedAt !== undefined && { postedAt: new Date(postedAt) }),
        ...(isArchived !== undefined && {
          isArchived,
          archivedAt: isArchived ? new Date() : null,
        }),
      },
      include: {
        of_models: {
          select: {
            id: true,
            name: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error updating gallery item:", error);
    return NextResponse.json(
      { error: "Failed to update gallery item" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a gallery item
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if item exists
    const existing = await prisma.gallery_items.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    await prisma.gallery_items.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Gallery item deleted" });
  } catch (error) {
    console.error("Error deleting gallery item:", error);
    return NextResponse.json(
      { error: "Failed to delete gallery item" },
      { status: 500 }
    );
  }
}
