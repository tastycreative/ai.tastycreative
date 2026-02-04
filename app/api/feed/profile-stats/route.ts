import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Verify user has access to this profile
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        OR: [
          { clerkId: userId },
          { user: { clerkId: userId } },
        ]
      }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found or access denied' }, { status: 404 });
    }

    // Get post statistics
    const posts = await prisma.feedPost.findMany({
      where: {
        profileId: profileId,
      },
      include: {
        likes: true,
        bookmarks: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, post) => sum + post.likes.length, 0);
    const totalBookmarks = posts.reduce((sum, post) => sum + post.bookmarks.length, 0);
    const lastPostDate = posts.length > 0 ? posts[0].createdAt.toISOString() : undefined;

    return NextResponse.json({
      totalPosts,
      totalLikes,
      totalBookmarks,
      lastPostDate,
    });
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile stats' },
      { status: 500 }
    );
  }
}
