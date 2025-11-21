// app/api/social/friends/[friendId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// DELETE - Remove a friend
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { friendId } = await params;

    // Delete friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { user1ClerkId: userId, user2ClerkId: friendId },
          { user1ClerkId: friendId, user2ClerkId: userId },
        ],
        status: "ACCEPTED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing friend:", error);
    return NextResponse.json(
      { error: "Failed to remove friend" },
      { status: 500 }
    );
  }
}
