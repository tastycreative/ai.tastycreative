import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST - Increment usage count when a reference is used
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify the item belongs to the user
    const item = await prisma.referenceItem.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Reference item not found" },
        { status: 404 }
      );
    }

    // Increment usage count and update lastUsedAt
    const updatedItem = await prisma.referenceItem.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Error tracking reference usage:", error);
    return NextResponse.json(
      { error: "Failed to track reference usage" },
      { status: 500 }
    );
  }
}
