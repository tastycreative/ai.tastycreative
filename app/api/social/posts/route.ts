// app/api/social/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma, ensureUserExists } from "@/lib/database";

// GET - Fetch posts from friends
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists
    await ensureUserExists(userId);

    // Get user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { user1ClerkId: userId, status: "ACCEPTED" },
          { user2ClerkId: userId, status: "ACCEPTED" },
        ],
      },
    });

    const friendIds = friendships.map((f) =>
      f.user1ClerkId === userId ? f.user2ClerkId : f.user1ClerkId
    );

    // Include user's own posts
    const allUserIds = [...friendIds, userId];

    // Fetch posts from friends and self
    const posts = await prisma.post.findMany({
      where: {
        user: {
          clerkId: {
            in: allUserIds,
          },
        },
      },
      include: {
        user: true,
        likes: {
          include: {
            user: true,
          },
        },
        comments: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
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
      take: 50,
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

// POST - Create a new post
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, imageUrl } = body;

    if (!content && !imageUrl) {
      return NextResponse.json(
        { error: "Post must have content or an image" },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        content,
        imageUrl,
      },
      include: {
        user: true,
        likes: {
          include: {
            user: true,
          },
        },
        comments: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
