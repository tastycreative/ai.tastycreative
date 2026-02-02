import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Mark a post as PUBLISHED manually
 * POST /api/instagram/mark-published
 * 
 * Used when user has manually posted to Instagram and wants to update the status in the app
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'Missing required field: postId' },
        { status: 400 }
      );
    }

    // Get the post from database
    const post = await prisma.instagramPost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user has permission
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    const canMarkPublished = 
      post.clerkId === userId || 
      (user && user.role === 'ADMIN');

    if (!canMarkPublished) {
      return NextResponse.json(
        { error: 'Unauthorized to update this post' },
        { status: 403 }
      );
    }

    // Update post status to PUBLISHED
    const updatedPost = await prisma.instagramPost.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Post ${postId} marked as published by user ${userId}`);

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: 'Post marked as published successfully',
    });

  } catch (error) {
    console.error('❌ Error marking post as published:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to mark post as published',
      },
      { status: 500 }
    );
  }
}
