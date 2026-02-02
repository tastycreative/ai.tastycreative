import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * Update an Instagram post
 * PATCH /api/instagram/posts/[id]
 * 
 * Allows updating caption, scheduled date, status, and post type
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { caption, scheduledDate, status, postType } = body;

    // Get the post from database
    const post = await prisma.instagramPost.findUnique({
      where: { id },
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
      select: { role: true },
    });

    const canEdit =
      post.clerkId === userId ||
      (user && user.role === 'ADMIN');

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Unauthorized to update this post' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (caption !== undefined) {
      updateData.caption = caption;
    }

    if (scheduledDate !== undefined) {
      updateData.scheduledAt = scheduledDate ? new Date(scheduledDate) : null;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (postType !== undefined) {
      updateData.type = postType;
    }

    // Update post
    const updatedPost = await prisma.instagramPost.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Post ${id} updated by user ${userId}`);

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: 'Post updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating post:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update post',
      },
      { status: 500 }
    );
  }
}
