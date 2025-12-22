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

    // Get accepted friendships to determine whose posts to include
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: user.id, status: "ACCEPTED" },
          { receiverId: user.id, status: "ACCEPTED" },
        ],
      },
    });

    // Extract friend IDs
    const friendIds = friendships.map((f) =>
      f.senderId === user.id ? f.receiverId : f.senderId
    );

    // Include own posts and friends' posts
    const userIds = [user.id, ...friendIds];

    // Get all posts from user and friends
    const posts = await prisma.feedPost.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        caption: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Get recent posts for hashtag analysis
    });

    // Extract hashtags from captions
    const hashtagMap = new Map<string, { count: number; engagement: number }>();

    posts.forEach((post) => {
      if (!post.caption) return;

      // Match hashtags (# followed by alphanumeric characters)
      const hashtags = post.caption.match(/#[\w]+/g);
      if (hashtags) {
        // Remove duplicates within the same post
        const uniqueHashtags = [...new Set(hashtags.map(tag => tag.toLowerCase()))];
        
        uniqueHashtags.forEach((tag) => {
          const current = hashtagMap.get(tag) || { count: 0, engagement: 0 };
          const postEngagement = post._count.likes + post._count.comments;
          
          hashtagMap.set(tag, {
            count: current.count + 1, // Number of posts using this hashtag
            engagement: current.engagement + postEngagement,
          });
        });
      }
    });

    // Convert to array and sort by engagement, then by count
    const trendingHashtags = Array.from(hashtagMap.entries())
      .map(([tag, data]) => ({ 
        tag, 
        count: data.count,
        engagement: data.engagement 
      }))
      .sort((a, b) => {
        // Sort by engagement first, then by count
        if (b.engagement !== a.engagement) {
          return b.engagement - a.engagement;
        }
        return b.count - a.count;
      })
      .slice(0, 5) // Top 5 hashtags
      .map(({ tag, count }) => ({ tag, count })); // Return only tag and count

    return NextResponse.json(trendingHashtags);
  } catch (error) {
    console.error("Error fetching trending hashtags:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
