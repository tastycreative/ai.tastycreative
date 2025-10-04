import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

/**
 * Debug endpoint to check scheduled posts
 * GET /api/instagram/debug-scheduled
 */
export async function GET() {
  try {
    const now = new Date();
    console.log(`🔍 Checking for scheduled posts at ${now.toISOString()}`);

    const scheduledPosts = await prisma.instagramPost.findMany({
      where: {
        status: 'SCHEDULED',
      },
      include: {
        user: {
          select: {
            clerkId: true,
            email: true,
          },
        },
      },
    });

    console.log(`📋 Found ${scheduledPosts.length} scheduled posts total`);

    const duePosts = scheduledPosts.filter(post => {
      if (!post.scheduledDate) return false;
      const schedDate = new Date(post.scheduledDate);
      const isDue = schedDate <= now;
      console.log(`  Post ${post.id}: scheduled=${schedDate.toISOString()}, now=${now.toISOString()}, isDue=${isDue}`);
      return isDue;
    });

    console.log(`⏰ ${duePosts.length} posts are due now`);

    return NextResponse.json({
      success: true,
      currentTime: now.toISOString(),
      currentTimeLocal: now.toString(),
      totalScheduled: scheduledPosts.length,
      dueNow: duePosts.length,
      posts: scheduledPosts.map(p => ({
        id: p.id,
        fileName: p.fileName,
        status: p.status,
        scheduledDate: p.scheduledDate,
        scheduledDateLocal: p.scheduledDate ? new Date(p.scheduledDate).toString() : null,
        isDue: p.scheduledDate ? new Date(p.scheduledDate) <= now : false,
        userEmail: p.user.email,
      })),
    });

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Debug failed',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
