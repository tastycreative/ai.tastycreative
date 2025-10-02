import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { google } from 'googleapis';

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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const post = await prisma.instagramPost.findFirst({
      where: {
        id: params.id,
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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { caption, scheduledDate, status, postType } = body;

    // Verify the post belongs to the user
    const existingPost = await prisma.instagramPost.findFirst({
      where: {
        id: params.id,
        clerkId: userId,
      },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Update the post
    const updatedPost = await prisma.instagramPost.update({
      where: { id: params.id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
        ...(status !== undefined && { status }),
        ...(postType !== undefined && { postType }),
      },
    });

    console.log(`✅ Updated Instagram post: ${params.id}`);

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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - user not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const deleteFromDrive = searchParams.get('deleteFromDrive') === 'true';
    const accessToken = searchParams.get('accessToken');

    // Fetch the post
    const post = await prisma.instagramPost.findFirst({
      where: {
        id: params.id,
        clerkId: userId,
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
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
      where: { id: params.id },
    });

    console.log(`✅ Deleted Instagram post: ${params.id}`);

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
