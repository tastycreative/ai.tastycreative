import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST - Bulk move items to a folder
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { itemIds, folderId } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "Item IDs are required" },
        { status: 400 }
      );
    }

    // If folderId is provided (and not null), verify folder belongs to user
    if (folderId !== null && folderId !== undefined) {
      const folder = await prisma.reference_folders.findFirst({
        where: {
          id: folderId,
          clerkId: userId,
        },
      });

      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    // Verify all items belong to the user
    const items = await prisma.reference_items.findMany({
      where: {
        id: { in: itemIds },
        clerkId: userId,
      },
    });

    if (items.length !== itemIds.length) {
      return NextResponse.json(
        { error: "Some items were not found or don't belong to you" },
        { status: 404 }
      );
    }

    // Move all items to the folder
    await prisma.reference_items.updateMany({
      where: {
        id: { in: itemIds },
        clerkId: userId,
      },
      data: {
        folderId: folderId || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      movedCount: itemIds.length 
    });
  } catch (error) {
    console.error("Error moving items:", error);
    return NextResponse.json(
      { error: "Failed to move items" },
      { status: 500 }
    );
  }
}
