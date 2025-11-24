// app\api\feed\profile\[userId]\posts\route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET - Fetch user's posts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: profileUserId } = await params;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: currentUserId },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }

    // Fetch posts
    const posts = await prisma.feedPost.findMany({
      where: { userId: profileUserId },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
          },
        },
        likes: {
          select: {
            userId: true,
          },
        },
        comments: {
          select: {
            id: true,
          },
        },
        bookmarks: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform posts
    const transformedPosts = posts.map((post) => ({
      id: post.id,
      imageUrls: post.imageUrls,
      caption: post.caption,
      createdAt: post.createdAt.toISOString(),
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      bookmarksCount: post.bookmarks.length,
      liked: post.likes.some(like => like.userId === currentUser.id),
      bookmarked: post.bookmarks.some(bookmark => bookmark.userId === currentUser.id),
      user: {
        id: post.user.id,
        clerkId: post.user.clerkId,
        username: post.user.username,
        firstName: post.user.firstName,
        lastName: post.user.lastName,
        email: post.user.email,
        imageUrl: post.user.imageUrl,
      },
    }));

    return NextResponse.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
