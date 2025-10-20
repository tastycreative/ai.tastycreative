import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserVideos, getVideoStats } from '@/lib/videoStorage';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeData = searchParams.get('includeData') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const stats = searchParams.get('stats') === 'true';
    const requestedUserId = searchParams.get('userId'); // Admin can request another user's content

    // Check if the requesting user is an admin
    let targetUserId = userId; // Default to current user
    if (requestedUserId) {
      // Import prisma
      const { prisma } = await import('@/lib/database');
      
      // Verify the requesting user is an admin
      const requestingUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });

      if (requestingUser?.role === 'ADMIN') {
        targetUserId = requestedUserId;
        console.log('🔑 Admin user requesting videos for userId:', requestedUserId);
      } else {
        console.warn('⚠️ Non-admin user attempted to access another user\'s videos');
        // Silently ignore the userId parameter for non-admins
      }
    }

    console.log('🎬 GET /api/videos:', {
      userId,
      targetUserId,
      includeData,
      limit,
      offset,
      stats
    });

    // If stats are requested, return stats instead of videos
    if (stats) {
      const videoStats = await getVideoStats(targetUserId);
      return NextResponse.json({ success: true, stats: videoStats });
    }

    // Get user videos
    const videos = await getUserVideos(targetUserId, {
      includeData,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      videos: videos,
      count: videos.length
    });

  } catch (error) {
    console.error('💥 Error in GET /api/videos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
