// app/api/social/friend-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, ensureUserExists } from "@/lib/database";

// POST - Send friend request
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { receiverId } = body;

    // Ensure both users exist in database
    await Promise.all([
      ensureUserExists(userId),
      ensureUserExists(receiverId)
    ]);

    if (!receiverId) {
      return NextResponse.json(
        { error: "Receiver ID is required" },
        { status: 400 }
      );
    }

    if (receiverId === userId) {
      return NextResponse.json(
        { error: "Cannot send friend request to yourself" },
        { status: 400 }
      );
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1ClerkId: userId, user2ClerkId: receiverId },
          { user1ClerkId: receiverId, user2ClerkId: userId },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === "ACCEPTED") {
        return NextResponse.json(
          { error: "Already friends" },
          { status: 400 }
        );
      } else if (existingFriendship.status === "PENDING") {
        return NextResponse.json(
          { error: "Friend request already sent" },
          { status: 400 }
        );
      }
    }

    // Create friendship request
    const friendship = await prisma.friendship.create({
      data: {
        user1ClerkId: userId,
        user2ClerkId: receiverId,
        status: "PENDING",
      },
    });

    return NextResponse.json(friendship);
  } catch (error) {
    console.error("Error sending friend request:", error);
    return NextResponse.json(
      { error: "Failed to send friend request" },
      { status: 500 }
    );
  }
}
