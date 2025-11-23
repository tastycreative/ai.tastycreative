import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST - Bookmark a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await params;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already bookmarked
    const existingBookmark = await prisma.feedPostBookmark.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: currentUser.id,
        },
      },
    });

    if (existingBookmark) {
      return NextResponse.json(
        { error: 'Post already bookmarked' },
        { status: 400 }
      );
    }

    // Create bookmark
    await prisma.feedPostBookmark.create({
      data: {
        postId,
        userId: currentUser.id,
      },
    });

    return NextResponse.json({ bookmarked: true });
  } catch (error) {
    console.error('Error bookmarking post:', error);
    return NextResponse.json(
      { error: 'Failed to bookmark post' },
      { status: 500 }
    );
  }
}

// DELETE - Remove bookmark
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await params;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete bookmark
    await prisma.feedPostBookmark.delete({
      where: {
        postId_userId: {
          postId,
          userId: currentUser.id,
        },
      },
    });

    return NextResponse.json({ bookmarked: false });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}
