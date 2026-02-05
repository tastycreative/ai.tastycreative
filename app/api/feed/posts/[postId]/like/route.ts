import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST - Like a post
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
    const { profileId } = await request.json();

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

    // Check if already liked
    const existingLike = await prisma.feedPostLike.findUnique({
      where: {
        postId_profileId: {
          postId,
          profileId,
        },
      },
    });

    if (existingLike) {
      return NextResponse.json(
        { error: 'Post already liked' },
        { status: 400 }
      );
    }

    // Create like
    await prisma.feedPostLike.create({
      data: {
        postId,
        userId: currentUser.id,
        profileId,
      },
    });

    // Get updated like count
    const likeCount = await prisma.feedPostLike.count({
      where: { postId },
    });

    return NextResponse.json({ liked: true, likeCount });
  } catch (error) {
    console.error('Error liking post:', error);
    return NextResponse.json(
      { error: 'Failed to like post' },
      { status: 500 }
    );
  }
}

// DELETE - Unlike a post
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
    const { profileId } = await request.json();

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

    // Delete like
    await prisma.feedPostLike.delete({
      where: {
        postId_profileId: {
          postId,
          profileId,
        },
      },
    });

    // Get updated like count
    const likeCount = await prisma.feedPostLike.count({
      where: { postId },
    });

    return NextResponse.json({ liked: false, likeCount });
  } catch (error) {
    console.error('Error unliking post:', error);
    return NextResponse.json(
      { error: 'Failed to unlike post' },
      { status: 500 }
    );
  }
}
