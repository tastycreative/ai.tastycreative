import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemIds, isFavorite } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "itemIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (typeof isFavorite !== "boolean") {
      return NextResponse.json(
        { error: "isFavorite must be a boolean" },
        { status: 400 }
      );
    }

    // Update all items
    await prisma.reference_items.updateMany({
      where: {
        id: { in: itemIds },
        clerkId: userId,
      },
      data: {
        isFavorite,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bulk favorite error:", error);
    return NextResponse.json(
      { error: "Failed to update favorites" },
      { status: 500 }
    );
  }
}
