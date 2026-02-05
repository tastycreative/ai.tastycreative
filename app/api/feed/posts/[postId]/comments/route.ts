import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch comments for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await params;

    // Get profileId from query params
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch comments (only top-level comments, not replies)
    const comments = await prisma.feedPostComment.findMany({
      where: { 
        postId,
        parentCommentId: null, // Only get top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            username: true,
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
        _count: {
          select: {
            likes: true,
            replies: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                clerkId: true,
                firstName: true,
                lastName: true,
                username: true,
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
            _count: {
              select: {
                likes: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Transform comments
    const transformedComments = comments.map(comment => ({
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
      profile: comment.profile,
      liked: comment.likes.length > 0,
      likeCount: comment._count.likes,
      replyCount: comment._count.replies,
      replies: comment.replies.map(reply => ({
        id: reply.id,
        postId: reply.postId,
        userId: reply.userId,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        user: reply.user,
        profile: reply.profile,
        liked: reply.likes.length > 0,
        likeCount: reply._count.likes,
        parentCommentId: reply.parentCommentId,
      })),
    }));

    return NextResponse.json(transformedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST - Add a comment
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
    const { content, parentCommentId, profileId } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Get current user with organization info
    const currentUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the profile belongs to the user OR their organization
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        OR: [
          { clerkId },
          { organizationId: currentUser.currentOrganizationId ?? undefined },
        ],
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or unauthorized' },
        { status: 404 }
      );
    }

    // If profile is from organization (not own profile), verify role
    if (profile.clerkId !== clerkId && profile.organizationId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          userId: currentUser.id,
          organizationId: profile.organizationId,
          role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
        },
      });
      
      if (!teamMember) {
        return NextResponse.json(
          { error: 'You are not authorized to use this profile' },
          { status: 403 }
        );
      }
    }

    // Create comment
    const comment = await prisma.feedPostComment.create({
      data: {
        postId,
        userId: currentUser.id,
        profileId: profileId,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            username: true,
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
            replies: true,
          },
        },
      },
    });

    // Get updated comment count (only top-level comments)
    const commentCount = await prisma.feedPostComment.count({
      where: { 
        postId,
        parentCommentId: null,
      },
    });

    // Transform comment
    const transformedComment = {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
      profile: comment.profile,
      liked: false,
      likeCount: comment._count.likes,
      replyCount: comment._count.replies,
      parentCommentId: comment.parentCommentId,
      replies: [],
    };

    return NextResponse.json({ comment: transformedComment, commentCount });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}
