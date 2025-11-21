// app/api/social/friends/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, ensureUserExists } from "@/lib/database";

// GET - Fetch user's friends
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists
    await ensureUserExists(userId);

    // Get accepted friendships
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1ClerkId: userId, status: "ACCEPTED" },
          { user2ClerkId: userId, status: "ACCEPTED" },
        ],
      },
    });

    // Get unique friend clerk IDs
    const friendClerkIds = friendships.map((friendship) => {
      return friendship.user1ClerkId === userId
        ? friendship.user2ClerkId
        : friendship.user1ClerkId;
    });

    // Fetch friend user details
    const friends = await prisma.user.findMany({
      where: {
        clerkId: {
          in: friendClerkIds,
        },
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        imageUrl: true,
      },
    });

    return NextResponse.json(friends);
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json(
      { error: "Failed to fetch friends" },
      { status: 500 }
    );
  }
}
