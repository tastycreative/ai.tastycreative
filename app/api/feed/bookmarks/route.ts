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

    // Get all bookmarked posts
    const bookmarks = await prisma.feedPostBookmark.findMany({
      where: {
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
            likes: {
              where: {
                userId: user.id,
              },
            },
            bookmarks: {
              where: {
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
    const posts = bookmarks.map((bookmark) => ({
      ...bookmark.post,
      isLiked: bookmark.post.likes.length > 0,
      isBookmarked: bookmark.post.bookmarks.length > 0,
      likeCount: bookmark.post._count.likes,
      commentCount: bookmark.post._count.comments,
    }));

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching bookmarked posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
