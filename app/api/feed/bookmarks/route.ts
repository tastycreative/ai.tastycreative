import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profileId from query params
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    // Find the user in the database with organization info
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify profile belongs to user OR their organization if profileId is provided
    if (profileId) {
      const profile = await prisma.instagramProfile.findFirst({
        where: {
          id: profileId,
          OR: [
            { clerkId: userId },
            { organizationId: user.currentOrganizationId ?? undefined },
          ],
        },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "Profile not found or unauthorized" },
          { status: 404 }
        );
      }
    }

    // Get all bookmarked posts for the profile
    const bookmarks = await prisma.feedPostBookmark.findMany({
      where: profileId ? {
        profileId,
      } : {
        userId: user.id,
      },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                clerkId: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
                imageUrl: true,
              },
            },
            profile: {
              select: {
                id: true,
                name: true,
                instagramUsername: true,
                profileImageUrl: true,
                organizationId: true,
              },
            },
            likes: {
              where: profileId ? {
                profileId,
              } : {
                userId: user.id,
              },
            },
            bookmarks: {
              where: profileId ? {
                profileId,
              } : {
                userId: user.id,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to match the feed post format
    // Use profile info if available, otherwise use user info
    const posts = bookmarks.map((bookmark) => {
      const post = bookmark.post;
      const displayUser = post.profile ? {
        id: post.profile.id,
        firstName: post.profile.name,
        lastName: '',
        username: post.profile.instagramUsername || '',
        imageUrl: post.profile.profileImageUrl || '/default-profile.png',
        email: '',
        clerkId: '',
      } : post.user;

      return {
        id: post.id,
        userId: post.userId,
        user: displayUser,
        profile: post.profile ? {
          id: post.profile.id,
          name: post.profile.name,
          instagramUsername: post.profile.instagramUsername,
          profileImageUrl: post.profile.profileImageUrl,
          organizationId: post.profile.organizationId,
        } : null,
        imageUrls: post.imageUrls,
        mediaType: post.mediaType,
        caption: post.caption,
        likes: post._count.likes,
        comments: post._count.comments,
        createdAt: post.createdAt.toISOString(),
        liked: post.likes.length > 0,
        bookmarked: post.bookmarks.length > 0,
        isLiked: post.likes.length > 0,
        isBookmarked: post.bookmarks.length > 0,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
      };
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching bookmarked posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
