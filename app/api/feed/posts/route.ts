import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch feed posts (from friends)
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get accepted friendships
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, status: 'ACCEPTED' },
          { receiverId: currentUser.id, status: 'ACCEPTED' },
        ],
      },
    });

    // Extract friend IDs
    const friendIds = friendships.map(f => 
      f.senderId === currentUser.id ? f.receiverId : f.senderId
    );

    // Include own posts and friends' posts
    const userIds = [currentUser.id, ...friendIds];

    // Fetch posts from user and friends
    const posts = await prisma.feedPost.findMany({
      where: {
        userId: { in: userIds },
      },
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
          where: { userId: currentUser.id },
          select: { id: true },
        },
        bookmarks: {
          where: { userId: currentUser.id },
          select: { id: true },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 posts
    });

    // Transform posts to match frontend interface
    const transformedPosts = posts.map(post => ({
      id: post.id,
      userId: post.userId,
      user: post.user,
      imageUrl: post.imageUrl,
      caption: post.caption,
      likes: post._count.likes,
      comments: post._count.comments,
      createdAt: post.createdAt.toISOString(),
      liked: post.likes.length > 0,
      bookmarked: post.bookmarks.length > 0,
    }));

    return NextResponse.json(transformedPosts);
  } catch (error) {
    console.error('Error fetching feed posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed posts' },
      { status: 500 }
    );
  }
}

// POST - Create a new post
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Create Post] Starting for user:', clerkId);

    const body = await request.json();
    const { imageUrl, caption } = body;

    console.log('[Create Post] Received data:', { imageUrl, caption: caption?.substring(0, 50) });

    if (!imageUrl || !caption) {
      console.error('[Create Post] Missing required fields');
      return NextResponse.json(
        { error: 'Image URL and caption are required' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      console.error('[Create Post] User not found:', clerkId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Create Post] User found:', currentUser.id);

    // Create the post
    const post = await prisma.feedPost.create({
      data: {
        userId: currentUser.id,
        imageUrl,
        caption,
      },
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
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    console.log('[Create Post] Post created:', post.id);

    // Transform to match frontend interface
    const transformedPost = {
      id: post.id,
      userId: post.userId,
      user: post.user,
      imageUrl: post.imageUrl,
      caption: post.caption,
      likes: post._count.likes,
      comments: post._count.comments,
      createdAt: post.createdAt.toISOString(),
      liked: false,
      bookmarked: false,
    };

    return NextResponse.json(transformedPost, { status: 201 });
  } catch (error: any) {
    console.error('[Create Post] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    );
  }
}
