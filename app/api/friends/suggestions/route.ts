import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user's default Instagram profile
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        clerkId: userId,
        isDefault: true
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get user's existing friends (accepted)
    const existingFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderProfileId: profile.id },
          { receiverProfileId: profile.id },
        ],
      },
    });

    // Extract all profile IDs that are already friends or have pending requests
    const connectedProfileIds = new Set<string>();
    existingFriendships.forEach((friendship) => {
      if (friendship.senderProfileId === profile.id) {
        connectedProfileIds.add(friendship.receiverProfileId);
      } else {
        connectedProfileIds.add(friendship.senderProfileId);
      }
    });

    // Get accepted friends only
    const acceptedFriendships = existingFriendships.filter(
      (f) => f.status === "ACCEPTED"
    );

    const friendIds = acceptedFriendships.map((f) =>
      f.senderProfileId === profile.id ? f.receiverProfileId : f.senderProfileId
    );

    if (friendIds.length === 0) {
      // No friends yet, return empty array
      return NextResponse.json([]);
    }

    // Get friends of friends
    const friendsOfFriends = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderProfileId: { in: friendIds }, status: "ACCEPTED" },
          { receiverProfileId: { in: friendIds }, status: "ACCEPTED" },
        ],
      },
      include: {
        senderProfile: {
          select: {
            id: true,
            clerkId: true,
            name: true,
            instagramUsername: true,
            profileImageUrl: true,
          },
        },
        receiverProfile: {
          select: {
            id: true,
            clerkId: true,
            name: true,
            instagramUsername: true,
            profileImageUrl: true,
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

      if (friendIds.includes(friendship.senderProfileId)) {
        // The receiver is the suggestion
        suggestedUser = friendship.receiverProfile;
        mutualFriendId = friendship.senderProfileId;
      } else {
        // The sender is the suggestion
        suggestedUser = friendship.senderProfile;
        mutualFriendId = friendship.receiverProfileId;
      }

      // Skip if this is the current profile or already connected
      if (
        suggestedUser.id === profile.id ||
        connectedProfileIds.has(suggestedUser.id)
      ) {
        return;
      }

      // Get mutual friend details
      const mutualFriend = friendsOfFriends.find(
        (f) => f.senderProfileId === mutualFriendId || f.receiverProfileId === mutualFriendId
      );

      let mutualFriendInfo;
      if (mutualFriend) {
        const mf =
          mutualFriend.senderProfileId === mutualFriendId
            ? mutualFriend.senderProfile
            : mutualFriend.receiverProfile;
        mutualFriendInfo = {
          id: mf.id,
          name: mf.instagramUsername || mf.name || "User",
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
        name: suggestion.user.name,
        instagramUsername: suggestion.user.instagramUsername,
        profileImageUrl: suggestion.user.profileImageUrl,
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
