import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { recordPostChange, notifyPostChange } from '@/lib/post-change-tracker';

// GET - Fetch Instagram posts (for current user OR specified user if Admin/Manager)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    // Check if requesting posts for a different user (Admin/Manager feature)
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    let postsClerkId = userId; // Default to current user

    // If requesting another user's posts, verify permissions
    if (targetUserId && targetUserId !== userId) {
      const currentUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });

      // Only ADMIN and MANAGER can view other users' posts
      if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER')) {
        return NextResponse.json(
          { error: 'Unauthorized - insufficient permissions to view other users posts' },
          { status: 403 }
        );
      }

      postsClerkId = targetUserId;
    }

    const posts = await prisma.instagramPost.findMany({
      where: { clerkId: postsClerkId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      posts,
      total: posts.length,
      viewingUserId: postsClerkId,
    });
  } catch (error) {
    console.error('❌ Error fetching Instagram posts:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch posts',
      },
      { status: 500 }
    );
  }
}

// POST - Create a new Instagram post
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      driveFileId,
      driveFileUrl,
      awsS3Key,
      awsS3Url,
      fileName,
      caption = '',
      scheduledDate,
      status = 'DRAFT',
      postType = 'POST',
      folder,
      originalFolder,
      mimeType,
    } = body;

    if (!fileName || !folder) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName or folder' },
        { status: 400 }
      );
    }

    const hasS3Payload = Boolean(awsS3Key && awsS3Url);
    const hasDrivePayload = Boolean(driveFileId && driveFileUrl);

    if (!hasS3Payload && !hasDrivePayload) {
      return NextResponse.json(
        { error: 'Missing media reference: provide awsS3Key/awsS3Url or driveFileId/driveFileUrl' },
        { status: 400 }
      );
    }

    // Get the highest order number for this user
    const maxOrderPost = await prisma.instagramPost.findFirst({
      where: { clerkId: userId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newOrder = (maxOrderPost?.order ?? -1) + 1;

    const post = await prisma.instagramPost.create({
      data: {
        clerkId: userId,
  driveFileId: hasDrivePayload ? driveFileId : null,
  driveFileUrl: hasDrivePayload ? driveFileUrl : null,
  awsS3Key: hasS3Payload ? awsS3Key : null,
  awsS3Url: hasS3Payload ? awsS3Url : null,
        fileName,
        caption,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        status,
        postType,
        folder,
        originalFolder: originalFolder || null,
        order: newOrder,
        mimeType,
      },
    });

    console.log(`✅ Created Instagram post: ${post.id}`);

    // Notify SSE clients (for local dev)
    try {
      notifyPostChange(post.id, 'create', post);
    } catch (error) {
      // SSE not available (production), ignore
    }

    // Record change for polling clients (for production)
    recordPostChange(post.id);

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('❌ Error creating Instagram post:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create post',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update post order (for drag-and-drop)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { posts } = body; // Array of { id, order }

    if (!posts || !Array.isArray(posts)) {
      return NextResponse.json(
        { error: 'Invalid request: posts array required' },
        { status: 400 }
      );
    }

    // Update all post orders in a transaction
    await prisma.$transaction(
      posts.map((post) =>
        prisma.instagramPost.update({
          where: { id: post.id, clerkId: userId },
          data: { order: post.order },
        })
      )
    );

    console.log(`✅ Updated order for ${posts.length} posts`);

    return NextResponse.json({
      success: true,
      message: 'Post order updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating post order:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update post order',
      },
      { status: 500 }
    );
  }
}
