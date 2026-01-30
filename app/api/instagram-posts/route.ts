import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { recordPostChange, notifyPostChange } from '@/lib/post-change-tracker';

// Helper function to check if user has access to a profile (owner or shared via organization)
async function hasAccessToProfile(userId: string, profileId: string): Promise<{hasAccess: boolean, profile: any}> {
  // First check if it's the user's own profile
  const ownProfile = await prisma.instagramProfile.findFirst({
    where: {
      id: profileId,
      clerkId: userId,
    },
  });

  if (ownProfile) {
    return { hasAccess: true, profile: ownProfile };
  }

  // Check if it's a shared organization profile via user's currentOrganizationId in database
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });

  if (user?.currentOrganizationId) {
    const orgProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        organizationId: user.currentOrganizationId,
      },
      include: {
        user: {
          select: { clerkId: true },
        },
      },
    });

    if (orgProfile) {
      return { hasAccess: true, profile: orgProfile };
    }
  }

  return { hasAccess: false, profile: null };
}

// Helper to get all accessible profile IDs for a user
async function getAccessibleProfileIds(userId: string): Promise<string[]> {
  // Get user's own profiles
  const ownProfiles = await prisma.instagramProfile.findMany({
    where: { clerkId: userId },
    select: { id: true },
  });

  // Get organization shared profiles via user's currentOrganizationId in database
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });
  
  const sharedProfiles = user?.currentOrganizationId
    ? await prisma.instagramProfile.findMany({
        where: {
          organizationId: user.currentOrganizationId,
          clerkId: { not: userId }, // Exclude own profiles to avoid duplicates
        },
        select: { id: true },
      })
    : [];

  return [...ownProfiles, ...sharedProfiles].map(p => p.id);
}

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
    const profileId = searchParams.get('profileId');

    let postsClerkId = userId; // Default to current user

    // If requesting another user's posts, verify permissions
    if (targetUserId && targetUserId !== userId) {
      const currentUserRecord = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });

      // Only SUPER_ADMIN, ADMIN and MANAGER can view other users' posts
      if (!currentUserRecord || (currentUserRecord.role !== 'SUPER_ADMIN' && currentUserRecord.role !== 'ADMIN' && currentUserRecord.role !== 'MANAGER')) {
        return NextResponse.json(
          { error: 'Unauthorized - insufficient permissions to view other users posts' },
          { status: 403 }
        );
      }

      postsClerkId = targetUserId;
    }

    // Build where clause - support shared profiles
    let whereClause: any;

    if (profileId) {
      // Specific profile requested - verify access
      const { hasAccess } = await hasAccessToProfile(userId, profileId);
      if (!hasAccess && postsClerkId === userId) {
        return NextResponse.json(
          { error: 'Unauthorized to access this profile' },
          { status: 403 }
        );
      }
      whereClause = { profileId };
    } else {
      // No specific profile - get all accessible posts
      if (postsClerkId === userId) {
        // Get posts for all accessible profiles (owned + shared)
        const accessibleProfileIds = await getAccessibleProfileIds(userId);
        whereClause = {
          OR: [
            { clerkId: userId }, // Own posts
            { profileId: { in: accessibleProfileIds } }, // Shared profile posts
          ]
        };
      } else {
        // Admin viewing specific user's posts
        whereClause = { clerkId: postsClerkId };
      }
    }

    const posts = await prisma.instagramPost.findMany({
      where: whereClause,
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
      profileId,
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

    // Determine the target clerkId - if this is a shared profile, use the profile owner's clerkId
    let targetClerkId = userId;
    if (profileId) {
      const { hasAccess, profile } = await hasAccessToProfile(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Unauthorized to create posts for this profile' },
          { status: 403 }
        );
      }
      // Use the profile owner's clerkId for data association
      targetClerkId = profile.clerkId;
    }

    // Get the highest order number for this profile (or user if no profile)
    const orderWhereClause = profileId 
      ? { profileId } 
      : { clerkId: targetClerkId };
    
    const maxOrderPost = await prisma.instagramPost.findFirst({
      where: orderWhereClause,
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newOrder = (maxOrderPost?.order ?? -1) + 1;

    const post = await prisma.instagramPost.create({
      data: {
        clerkId: targetClerkId,
        profileId: profileId || null,
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

    // Get accessible profile IDs for the user
    const accessibleProfileIds = await getAccessibleProfileIds(userId);

    // Update all post orders in a transaction
    // Allow updates for posts that belong to user OR are from accessible profiles
    await prisma.$transaction(
      posts.map((post) =>
        prisma.instagramPost.update({
          where: { 
            id: post.id,
            OR: [
              { clerkId: userId },
              { profileId: { in: accessibleProfileIds } }
            ]
          },
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
