import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's existing friends (accepted)
    const existingFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
      },
    });

    // Extract all user IDs that are already friends or have pending requests
    const connectedUserIds = new Set<string>();
    existingFriendships.forEach((friendship) => {
      if (friendship.senderId === user.id) {
        connectedUserIds.add(friendship.receiverId);
      } else {
        connectedUserIds.add(friendship.senderId);
      }
    });

    // Get accepted friends only
    const acceptedFriendships = existingFriendships.filter(
      (f) => f.status === "ACCEPTED"
    );

    const friendIds = acceptedFriendships.map((f) =>
      f.senderId === user.id ? f.receiverId : f.senderId
    );

    if (friendIds.length === 0) {
      // No friends yet, return empty array
      return NextResponse.json([]);
    }

    // Get friends of friends
    const friendsOfFriends = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: { in: friendIds }, status: "ACCEPTED" },
          { receiverId: { in: friendIds }, status: "ACCEPTED" },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            imageUrl: true,
          },
        },
      },
    });

    // Map to track mutual friends count
    const suggestionMap = new Map<
      string,
      {
        user: any;
        mutualFriends: Array<{ id: string; name: string }>;
      }
    >();

    friendsOfFriends.forEach((friendship) => {
      // Determine which user is the friend of friend
      let suggestedUser;
      let mutualFriendId;

      if (friendIds.includes(friendship.senderId)) {
        // The receiver is the suggestion
        suggestedUser = friendship.receiver;
        mutualFriendId = friendship.senderId;
      } else {
        // The sender is the suggestion
        suggestedUser = friendship.sender;
        mutualFriendId = friendship.receiverId;
      }

      // Skip if this is the current user or already connected
      if (
        suggestedUser.id === user.id ||
        connectedUserIds.has(suggestedUser.id)
      ) {
        return;
      }

      // Get mutual friend details
      const mutualFriend = friendsOfFriends.find(
        (f) => f.senderId === mutualFriendId || f.receiverId === mutualFriendId
      );

      let mutualFriendInfo;
      if (mutualFriend) {
        const mf =
          mutualFriend.senderId === mutualFriendId
            ? mutualFriend.sender
            : mutualFriend.receiver;
        mutualFriendInfo = {
          id: mf.id,
          name:
            mf.username ||
            `${mf.firstName || ""} ${mf.lastName || ""}`.trim() ||
            (mf.email ? mf.email.split("@")[0] : "User"),
        };
      }

      // Add or update suggestion
      const existing = suggestionMap.get(suggestedUser.id);
      if (existing) {
        if (mutualFriendInfo) {
          existing.mutualFriends.push(mutualFriendInfo);
        }
      } else {
        suggestionMap.set(suggestedUser.id, {
          user: suggestedUser,
          mutualFriends: mutualFriendInfo ? [mutualFriendInfo] : [],
        });
      }
    });

    // Convert to array and sort by mutual friends count
    const suggestions = Array.from(suggestionMap.values())
      .map((suggestion) => ({
        id: suggestion.user.id,
        clerkId: suggestion.user.clerkId,
        email: suggestion.user.email,
        firstName: suggestion.user.firstName,
        lastName: suggestion.user.lastName,
        username: suggestion.user.username,
        imageUrl: suggestion.user.imageUrl,
        mutualFriendsCount: suggestion.mutualFriends.length,
        mutualFriends: suggestion.mutualFriends.slice(0, 3), // Show up to 3 mutual friends
      }))
      .sort((a, b) => b.mutualFriendsCount - a.mutualFriendsCount)
      .slice(0, 5); // Top 5 suggestions

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Error fetching friend suggestions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
