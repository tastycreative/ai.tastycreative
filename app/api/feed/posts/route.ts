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

    // Get profileId and ownOnly from query params
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const ownOnly = searchParams.get('ownOnly') === 'true';

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let friendProfileIds: string[] = [];

    // If profileId is specified and not ownOnly, get friendships for that profile
    if (profileId && !ownOnly) {
      // Get accepted friendships for this profile
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { senderProfileId: profileId, status: 'ACCEPTED' },
            { receiverProfileId: profileId, status: 'ACCEPTED' },
          ],
        },
      });

      // Extract friend profile IDs
      friendProfileIds = friendships.map(f => 
        f.senderProfileId === profileId ? f.receiverProfileId : f.senderProfileId
      );
    }

    // Fetch posts based on parameters
    let whereClause: any;
    if (profileId && ownOnly) {
      // Only show this profile's own posts
      whereClause = { profileId: profileId };
    } else if (profileId) {
      // Show this profile's posts and friends' posts
      whereClause = {
        OR: [
          { profileId: profileId }, // Own profile's posts
          { profileId: { in: friendProfileIds } }, // Friends' posts
        ],
      };
    } else {
      // Show all posts from user's own profiles
      whereClause = { userId: currentUser.id };
    }

    // Fetch posts from user and friends
    const friendsPosts = await prisma.feedPost.findMany({
      where: whereClause,
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
          },
        },
        likes: {
          where: profileId ? { profileId } : { userId: currentUser.id },
          select: { id: true },
        },
        bookmarks: {
          where: profileId ? { profileId } : { userId: currentUser.id },
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
      take: 30, // Limit friends posts
    });

    // Transform posts to match frontend interface
    // Use profile info if available, otherwise use user info
    const transformedPosts = friendsPosts.map(post => {
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
        imageUrls: post.imageUrls,
        mediaType: post.mediaType as 'image' | 'video',
        caption: post.caption,
        likes: post._count.likes,
        comments: post._count.comments,
        createdAt: post.createdAt.toISOString(),
        liked: post.likes.length > 0,
        bookmarked: post.bookmarks.length > 0,
        isFriend: true,
      };
    });

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
    const { imageUrls, caption, mediaType = 'image', profileId } = body;

    console.log('[Create Post] Received data:', { imageUrls, caption: caption?.substring(0, 50), mediaType, profileId });

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0 || !caption) {
      console.error('[Create Post] Missing required fields');
      return NextResponse.json(
        { error: 'Image URLs array and caption are required' },
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
        imageUrls,
        mediaType,
        caption,
        ...(profileId && { profileId }),
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
        profile: {
          select: {
            id: true,
            name: true,
            instagramUsername: true,
            profileImageUrl: true,
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
    // Use profile info if available, otherwise use user info
    const displayUser = post.profile ? {
      id: post.profile.id,
      firstName: post.profile.name,
      lastName: '',
      username: post.profile.instagramUsername || '',
      imageUrl: post.profile.profileImageUrl || '/default-profile.png',
      email: '',
      clerkId: '',
    } : post.user;

    const transformedPost = {
      id: post.id,
      userId: post.userId,
      user: displayUser,
      imageUrls: post.imageUrls,
      mediaType: post.mediaType as 'image' | 'video',
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
