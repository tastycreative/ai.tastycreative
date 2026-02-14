import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// POST /api/vault/folders/reorder - Update the order of folders
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderOrders } = body;

    // folderOrders should be an array of { folderId: string, order: number }
    if (!Array.isArray(folderOrders)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Update each folder's order in a transaction
    await prisma.$transaction(
      folderOrders.map(({ folderId, order }) =>
        prisma.vaultFolder.update({
          where: { 
            id: folderId,
            clerkId: userId, // Ensure user owns the folder
          },
          data: { order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering folders:", error);
    return NextResponse.json(
      { error: "Failed to reorder folders" },
      { status: 500 }
    );
  }
}
