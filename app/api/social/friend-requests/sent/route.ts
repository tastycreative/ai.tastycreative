// app/api/social/friend-requests/sent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, ensureUserExists } from "@/lib/database";

// GET - Fetch sent friend requests
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
        user1ClerkId: userId,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get receiver IDs
    const receiverIds = requests.map((r) => r.user2ClerkId);

    // Fetch receiver details
    const receivers = await prisma.user.findMany({
      where: {
        clerkId: {
          in: receiverIds,
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
    const receiverMap = new Map(receivers.map((r) => [r.clerkId, r]));

    // Fetch current user details
    const sender = await prisma.user.findUnique({
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
        sender,
        receiver: receiverMap.get(request.user2ClerkId),
      }))
      .filter((req) => req.sender && req.receiver); // Filter out requests with missing user data

    return NextResponse.json(formattedRequests);
  } catch (error) {
    console.error("Error fetching sent friend requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch friend requests" },
      { status: 500 }
    );
  }
}
