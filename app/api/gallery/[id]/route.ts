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
        profile: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
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
      profileId,
      captionUsed,
      postedAt,
      isArchived,
    } = body;

    // Validate profileId if provided
    if (profileId) {
      const profile = await prisma.instagramProfile.findUnique({
        where: { id: profileId },
      });
      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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
        ...(profileId !== undefined && { profileId }),
        ...(captionUsed !== undefined && { captionUsed }),
        ...(postedAt !== undefined && { postedAt: new Date(postedAt) }),
        ...(isArchived !== undefined && {
          isArchived,
          archivedAt: isArchived ? new Date() : null,
        }),
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
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

// DELETE - Permanently delete a gallery item
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.gallery_items.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    await prisma.gallery_items.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting gallery item:", error);
    return NextResponse.json(
      { error: "Failed to delete gallery item" },
      { status: 500 }
    );
  }
}