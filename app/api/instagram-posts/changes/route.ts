import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// Track last change timestamp per user
const lastChanges = new Map<string, { timestamp: number; postIds: string[] }>();

// Function to record a change (called from other API routes)
export function recordPostChange(postId: string) {
  const now = Date.now();
  
  // Update all users' change records
  lastChanges.forEach((value, userId) => {
    if (!value.postIds.includes(postId)) {
      value.postIds.push(postId);
    }
    value.timestamp = now;
  });
}

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

    // Initialize user's change record if needed
    if (!lastChanges.has(userId)) {
      lastChanges.set(userId, { timestamp: Date.now(), postIds: [] });
    }

    const userChanges = lastChanges.get(userId);
    
    // Check if there have been changes since lastCheck
    const hasChanges = userChanges && userChanges.timestamp > lastCheck;

    if (hasChanges) {
      // Fetch updated posts
      const isAdminOrManager = user.role === 'ADMIN' || user.role === 'MANAGER';
      
      // Build query based on role and selected user
      let whereClause: any = {};
      
      if (isAdminOrManager && viewingUserId) {
        // Admin/Manager viewing specific user's posts
        whereClause.clerkId = viewingUserId;
      } else if (!isAdminOrManager) {
        // Content Creator can only see their own posts
        whereClause.clerkId = userId;
      }
      // If Admin/Manager with no viewingUserId, show all posts (empty where clause)

      const posts = await prisma.instagramPost.findMany({
        where: whereClause,
        orderBy: { order: 'asc' }
      });

      // Clear the postIds for this user
      if (userChanges) {
        userChanges.postIds = [];
      }

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
