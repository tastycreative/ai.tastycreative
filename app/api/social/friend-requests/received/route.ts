// app/api/social/friend-requests/received/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, ensureUserExists } from "@/lib/database";

// GET - Fetch received friend requests
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists
    await ensureUserExists(userId);

    const requests = await prisma.friendship.findMany({
      where: {
        user2ClerkId: userId,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get sender IDs
    const senderIds = requests.map((r) => r.user1ClerkId);

    // Fetch sender details
    const senders = await prisma.user.findMany({
      where: {
        clerkId: {
          in: senderIds,
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

    // Create a map for quick lookup
    const senderMap = new Map(senders.map((s) => [s.clerkId, s]));

    // Fetch current user details
    const receiver = await prisma.user.findUnique({
      where: { clerkId: userId },
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

    // Map to include sender and receiver, filtering out requests with missing user data
    const formattedRequests = requests
      .map((request) => ({
        id: request.id,
        senderId: request.user1ClerkId,
        receiverId: request.user2ClerkId,
        status: request.status,
        createdAt: request.createdAt,
        sender: senderMap.get(request.user1ClerkId),
        receiver,
      }))
      .filter((req) => req.sender && req.receiver); // Filter out requests with missing user data

    return NextResponse.json(formattedRequests);
  } catch (error) {
    console.error("Error fetching received friend requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch friend requests" },
      { status: 500 }
    );
  }
}
