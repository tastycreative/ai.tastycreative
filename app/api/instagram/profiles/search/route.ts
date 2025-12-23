import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const excludeProfileId = searchParams.get("excludeProfileId");

    console.log("Search query:", query, "User ID:", userId, "Exclude Profile ID:", excludeProfileId);

    const searchTerm = query?.trim().toLowerCase() || "";

    // Get existing friendships and pending requests for this profile
    const excludeProfileIds: string[] = [];
    if (excludeProfileId) {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { senderProfileId: excludeProfileId },
            { receiverProfileId: excludeProfileId },
          ],
        },
        select: {
          senderProfileId: true,
          receiverProfileId: true,
        },
      });

      // Collect all profile IDs that are connected (friends or pending requests)
      friendships.forEach((friendship) => {
        if (friendship.senderProfileId === excludeProfileId) {
          excludeProfileIds.push(friendship.receiverProfileId);
        } else {
          excludeProfileIds.push(friendship.senderProfileId);
        }
      });

      // Also exclude the current profile itself
      excludeProfileIds.push(excludeProfileId);
    }

    console.log("Excluding profile IDs:", excludeProfileIds);

    // Search Instagram profiles by name or Instagram username
    const whereClause: any = {};

    // Exclude connected profiles
    if (excludeProfileIds.length > 0) {
      whereClause.id = {
        notIn: excludeProfileIds,
      };
    }

    // Only add search filter if query is provided
    if (searchTerm) {
      whereClause.OR = [
        {
          name: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          instagramUsername: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }

    const profiles = await prisma.instagramProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            clerkId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      take: 20,
      orderBy: {
        name: "asc",
      },
    });

    console.log("Found profiles:", profiles.length);
    if (profiles.length > 0) {
      console.log("Sample profile:", profiles[0]);
    }

    // Transform to include clerkId at the profile level for easier access
    const profilesWithClerkId = profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      instagramUsername: profile.instagramUsername,
      profileImageUrl: profile.profileImageUrl,
      clerkId: profile.user.clerkId,
      user: {
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
      },
    }));

    return NextResponse.json(profilesWithClerkId);
  } catch (error) {
    console.error("Error searching Instagram profiles:", error);
    return NextResponse.json(
      { error: "Failed to search profiles" },
      { status: 500 }
    );
  }
}
