import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST - Reorder images within a sexting set
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { setId, imageIds } = body;

    if (!setId || !imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json(
        { error: "Set ID and image IDs array are required" },
        { status: 400 }
      );
    }

    // Verify ownership of the set
    const existingSet = await prisma.sextingSet.findFirst({
      where: { id: setId, userId },
      include: { images: true },
    });

    if (!existingSet) {
      return NextResponse.json(
        { error: "Set not found or unauthorized" },
        { status: 404 }
      );
    }

    // Update sequence for each image
    const updatePromises = imageIds.map((imageId: string, index: number) =>
      prisma.sextingImage.updateMany({
        where: {
          id: imageId,
          setId: setId, // Ensure image belongs to this set
        },
        data: {
          sequence: index + 1, // 1-based sequence
        },
      })
    );

    await Promise.all(updatePromises);

    // Fetch updated set with images
    const updatedSet = await prisma.sextingSet.findUnique({
      where: { id: setId },
      include: {
        images: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json({ set: updatedSet });
  } catch (error) {
    console.error("Error reordering sexting set images:", error);
    return NextResponse.json(
      { error: "Failed to reorder images" },
      { status: 500 }
    );
  }
}
