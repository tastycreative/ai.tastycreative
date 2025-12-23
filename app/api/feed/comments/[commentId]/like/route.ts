import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST - Like a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await params;
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the profile belongs to the user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or unauthorized' },
        { status: 404 }
      );
    }

    // Create like
    await prisma.feedPostCommentLike.create({
      data: {
        commentId,
        userId: currentUser.id,
        profileId,
      },
    });

    // Get updated like count
    const likeCount = await prisma.feedPostCommentLike.count({
      where: { commentId },
    });

    return NextResponse.json({ likeCount, liked: true });
  } catch (error: any) {
    // Handle unique constraint violation (already liked)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Already liked' }, { status: 400 });
    }
    console.error('Error liking comment:', error);
    return NextResponse.json(
      { error: 'Failed to like comment' },
      { status: 500 }
    );
  }
}

// DELETE - Unlike a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await params;
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete like
    await prisma.feedPostCommentLike.deleteMany({
      where: {
        commentId,
        profileId,
      },
    });

    // Get updated like count
    const likeCount = await prisma.feedPostCommentLike.count({
      where: { commentId },
    });

    return NextResponse.json({ likeCount, liked: false });
  } catch (error) {
    console.error('Error unliking comment:', error);
    return NextResponse.json(
      { error: 'Failed to unlike comment' },
      { status: 500 }
    );
  }
}
