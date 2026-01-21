import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// GET - Fetch all sexting sets for the user (optionally filtered by profileId)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    const sets = await prisma.sextingSet.findMany({
      where: {
        userId,
        ...(profileId && { category: profileId }),
      },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ sets });
  } catch (error) {
    console.error("Error fetching sexting sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch sexting sets" },
      { status: 500 }
    );
  }
}

// POST - Create a new sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, profileId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Set name is required" },
        { status: 400 }
      );
    }

    // Generate S3 folder path
    const s3FolderPath = `sexting-sets/${userId}/${profileId || "general"}/${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

    const set = await prisma.sextingSet.create({
      data: {
        userId,
        name,
        category: category || profileId || "general",
        s3FolderPath,
        status: "draft",
      },
      include: {
        images: true,
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error creating sexting set:", error);
    return NextResponse.json(
      { error: "Failed to create sexting set" },
      { status: 500 }
    );
  }
}

// PATCH - Update a sexting set
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category, status, scheduledDate } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id, userId },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    const set = await prisma.sextingSet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(status && { status }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
      },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({ set });
  } catch (error) {
    console.error("Error updating sexting set:", error);
    return NextResponse.json(
      { error: "Failed to update sexting set" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a sexting set
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Set ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id, userId },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete will cascade to images due to schema relation
    await prisma.sextingSet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sexting set:", error);
    return NextResponse.json(
      { error: "Failed to delete sexting set" },
      { status: 500 }
    );
  }
}
