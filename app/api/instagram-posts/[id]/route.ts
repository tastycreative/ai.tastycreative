import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma, withRetry } from '@/lib/database';
import { google } from 'googleapis';
import { recordPostChange, notifyPostChange } from '@/lib/post-change-tracker';

// Helper to initialize Google Drive client
function getDriveClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// GET - Fetch a single post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const post = await prisma.instagramPost.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('❌ Error fetching Instagram post:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch post',
      },
      { status: 500 }
    );
  }
}

// PATCH - Update a post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { caption, scheduledDate, status, postType, rejectionReason } = body;

    // Get current user's role from database
    const currentUser = await withRetry(() => 
      prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      })
    );

    // Check if post exists
    const existingPost = await withRetry(() =>
      prisma.instagramPost.findUnique({
        where: { id },
      })
    );

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Allow if:
    // 1. User owns the post, OR
    // 2. User is ADMIN or MANAGER (can edit any post)
    const canEdit = 
      existingPost.clerkId === userId || 
      (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER'));

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Unauthorized - insufficient permissions to edit this post' },
        { status: 403 }
      );
    }

    // Update the post
    const updatedPost = await withRetry(() =>
      prisma.instagramPost.update({
        where: { id },
        data: {
          ...(caption !== undefined && { caption }),
          ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
          ...(status !== undefined && { status }),
          ...(postType !== undefined && { postType }),
          // Handle rejection
          ...(status === 'DRAFT' && rejectionReason && {
            rejectedAt: new Date(),
            rejectionReason,
            rejectedBy: userId,
          }),
          // Clear rejection info when post is resubmitted or approved
          ...((status === 'REVIEW' || status === 'APPROVED') && {
            rejectedAt: null,
            rejectionReason: null,
            rejectedBy: null,
          }),
        },
      })
    );

    console.log(`✅ Updated Instagram post: ${id} by user ${userId} (role: ${currentUser?.role || 'USER'})`);

    // Notify SSE clients (for local dev)
    try {
      notifyPostChange(id, 'update', updatedPost);
    } catch (error) {
      // SSE not available (production), ignore
    }

    // Record change for polling clients (for production)
    recordPostChange(id);

    return NextResponse.json({
      success: true,
      post: updatedPost,
    });
  } catch (error) {
    console.error('❌ Error updating Instagram post:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update post',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a post (from database and optionally from Google Drive)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const deleteFromDrive = searchParams.get('deleteFromDrive') === 'true';
    const accessToken = searchParams.get('accessToken');

    // Get current user's role from database
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    // Fetch the post
    const post = await prisma.instagramPost.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Allow if:
    // 1. User owns the post, OR
    // 2. User is ADMIN or MANAGER (can delete any post)
    const canDelete = 
      post.clerkId === userId || 
      (currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER'));

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Unauthorized - insufficient permissions to delete this post' },
        { status: 403 }
      );
    }

    // Delete from Google Drive if requested
    if (deleteFromDrive && accessToken && post.driveFileId) {
      try {
        const drive = getDriveClient(accessToken);
        await drive.files.delete({
          fileId: post.driveFileId,
        });
        console.log(`🗑️ Deleted file from Google Drive: ${post.driveFileId}`);
      } catch (driveError) {
        console.error('⚠️ Failed to delete from Google Drive:', driveError);
        // Continue with database deletion even if Drive deletion fails
      }
    }

    // Delete from database
    await prisma.instagramPost.delete({
      where: { id },
    });

    // Notify SSE clients (for local dev)
    try {
      notifyPostChange(id, 'delete');
    } catch (error) {
      // SSE not available (production), ignore
    }

    // Record change for polling clients (for production)
    recordPostChange(id);

    console.log(`✅ Deleted Instagram post: ${id} by user ${userId} (role: ${currentUser?.role || 'USER'})`);

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
      deletedFromDrive: deleteFromDrive,
    });
  } catch (error) {
    console.error('❌ Error deleting Instagram post:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to delete post',
      },
      { status: 500 }
    );
  }
}
