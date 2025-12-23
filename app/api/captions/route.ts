import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Fetch captions for a specific profile
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    const captions = await prisma.caption.findMany({
      where: {
        profileId,
        clerkId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(captions);
  } catch (error) {
    console.error("Error fetching captions:", error);
    return NextResponse.json(
      { error: "Failed to fetch captions" },
      { status: 500 }
    );
  }
}

// POST - Create a new caption
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileId, caption, captionCategory, captionTypes, captionBanks } = body;

    if (!profileId || !caption || !captionCategory || !captionTypes || !captionBanks) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify profile belongs to user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found or unauthorized" },
        { status: 404 }
      );
    }

    const newCaption = await prisma.caption.create({
      data: {
        clerkId: userId,
        profileId,
        caption,
        captionCategory,
        captionTypes,
        captionBanks,
      },
    });

    return NextResponse.json(newCaption, { status: 201 });
  } catch (error) {
    console.error("Error creating caption:", error);
    return NextResponse.json(
      { error: "Failed to create caption" },
      { status: 500 }
    );
  }
}

// PUT - Update a caption
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, caption, captionCategory, captionTypes, captionBanks } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Caption ID is required" },
        { status: 400 }
      );
    }

    // Verify caption belongs to user
    const existingCaption = await prisma.caption.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found or unauthorized" },
        { status: 404 }
      );
    }

    const updatedCaption = await prisma.caption.update({
      where: { id },
      data: {
        caption,
        captionCategory,
        captionTypes,
        captionBanks,
      },
    });

    return NextResponse.json(updatedCaption);
  } catch (error) {
    console.error("Error updating caption:", error);
    return NextResponse.json(
      { error: "Failed to update caption" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a caption
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Caption ID is required" },
        { status: 400 }
      );
    }

    // Verify caption belongs to user
    const existingCaption = await prisma.caption.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingCaption) {
      return NextResponse.json(
        { error: "Caption not found or unauthorized" },
        { status: 404 }
      );
    }

    await prisma.caption.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting caption:", error);
    return NextResponse.json(
      { error: "Failed to delete caption" },
      { status: 500 }
    );
  }
}
