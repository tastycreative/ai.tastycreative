import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST - Reorder sexting sets (folders)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { setIds } = body;

    if (!setIds || !Array.isArray(setIds) || setIds.length === 0) {
      return NextResponse.json(
        { error: "Set IDs array is required" },
        { status: 400 }
      );
    }

    // Verify all sets exist and user has access
    const sets = await prisma.sextingSet.findMany({
      where: { id: { in: setIds } },
      select: { id: true, userId: true, category: true },
    });

    if (sets.length !== setIds.length) {
      return NextResponse.json(
        { error: "Some sets were not found" },
        { status: 404 }
      );
    }

    // Update sortOrder for each set
    const updatePromises = setIds.map((setId: string, index: number) =>
      prisma.sextingSet.update({
        where: { id: setId },
        data: { sortOrder: index },
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering sexting sets:", error);
    return NextResponse.json(
      { error: "Failed to reorder sets" },
      { status: 500 }
    );
  }
}
