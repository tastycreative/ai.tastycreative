// app/api/social/friend-requests/[requestId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database";

// PATCH - Accept or reject a friend request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await req.json();
    const { accept } = body;

    // Get the friend request
    const request = await prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Verify the user is the receiver
    if (request.user2ClerkId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to respond to this request" },
        { status: 403 }
      );
    }

    if (accept) {
      // Accept the request
      const updatedRequest = await prisma.friendship.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      return NextResponse.json(updatedRequest);
    } else {
      // Reject the request
      await prisma.friendship.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error responding to friend request:", error);
    return NextResponse.json(
      { error: "Failed to respond to friend request" },
      { status: 500 }
    );
  }
}
