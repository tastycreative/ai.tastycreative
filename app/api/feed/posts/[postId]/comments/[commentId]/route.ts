import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// DELETE - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, commentId } = await params;

    // Get current user with organization info
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the comment to check ownership
    const comment = await prisma.feedPostComment.findUnique({
      where: { id: commentId },
      include: {
        profile: {
          select: {
            id: true,
            clerkId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user can delete the comment
    const isOwnComment = comment.userId === currentUser.id;
    
    // Check if user has org access to the comment's profile
    let hasOrgAccess = false;
    if (!isOwnComment && comment.profile?.organizationId && 
        comment.profile.organizationId === currentUser.currentOrganizationId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          userId: currentUser.id,
          organizationId: comment.profile.organizationId,
          role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
        },
      });
      hasOrgAccess = !!teamMember;
    }

    // Only allow deleting own comments or if user has org access
    if (!isOwnComment && !hasOrgAccess) {
      return NextResponse.json(
        { error: 'Not authorized to delete this comment' },
        { status: 403 }
      );
    }

    // Delete comment
    await prisma.feedPostComment.delete({
      where: { id: commentId },
    });

    // Get updated comment count
    const commentCount = await prisma.feedPostComment.count({
      where: { postId },
    });

    return NextResponse.json({ success: true, commentCount });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
