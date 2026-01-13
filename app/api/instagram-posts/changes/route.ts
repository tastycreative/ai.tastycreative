import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { getUserChanges, clearUserPostIds } from '@/lib/post-change-tracker';

// GET - Check for changes since last poll
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's role
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }
    });

    if (!user || !['ADMIN', 'MANAGER', 'CONTENT_CREATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get lastCheck timestamp from query
    const { searchParams } = new URL(request.url);
    const lastCheck = parseInt(searchParams.get('lastCheck') || '0');
    const viewingUserId = searchParams.get('userId');
    const profileId = searchParams.get('profileId');

    // Get user's change record
    const userChanges = getUserChanges(userId);
    
    // Check if there have been changes since lastCheck
    const hasChanges = userChanges && userChanges.timestamp > lastCheck;

    if (hasChanges) {
      // Fetch updated posts
      const isAdminOrManager = user.role === 'ADMIN' || user.role === 'MANAGER';
      
      // Build query based on role and selected user
      let whereClause: any;
      
      if (isAdminOrManager && viewingUserId) {
        // Admin/Manager viewing specific user's posts
        whereClause = { clerkId: viewingUserId };
      } else if (!isAdminOrManager) {
        // Content Creator can only see their own posts
        whereClause = { clerkId: userId };
      } else {
        // Admin/Manager with no viewingUserId, show all posts
        whereClause = {};
      }

      // Add profileId filter if provided
      if (profileId) {
        whereClause.profileId = profileId;
      }

      const posts = await prisma.instagramPost.findMany({
        where: whereClause,
        orderBy: { order: 'asc' }
      });

      // Clear the postIds for this user
      clearUserPostIds(userId);

      return NextResponse.json({
        hasChanges: true,
        posts,
        timestamp: Date.now()
      });
    }

    // No changes
    return NextResponse.json({
      hasChanges: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Error checking changes:', error);
    return NextResponse.json(
      { error: 'Failed to check changes' },
      { status: 500 }
    );
  }
}
