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

    // Get user's activity stats
    const [postsCount, likesGivenCount, commentsGivenCount, bookmarksCount] = await Promise.all([
      // Count of posts created by user
      prisma.feedPost.count({
        where: { userId: user.id },
      }),
      
      // Count of likes given by user
      prisma.feedPostLike.count({
        where: { userId: user.id },
      }),
      
      // Count of comments made by user
      prisma.feedPostComment.count({
        where: { userId: user.id },
      }),
      
      // Count of bookmarks saved by user
      prisma.feedPostBookmark.count({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({
      posts: postsCount,
      likes: likesGivenCount,
      comments: commentsGivenCount,
      bookmarks: bookmarksCount,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
