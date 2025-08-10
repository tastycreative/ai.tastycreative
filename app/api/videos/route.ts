// app/api/videos/route.ts - Video API endpoints
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserVideos, getVideoStats, getVideosByFormat } from '@/lib/videoStorage';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stats = searchParams.get('stats');
    const format = searchParams.get('format');
    const jobId = searchParams.get('jobId');
    const includeData = searchParams.get('includeData') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    // Return video statistics
    if (stats === 'true') {
      console.log('📊 Getting video stats for user:', clerkId);
      const videoStats = await getVideoStats(clerkId);
      
      return NextResponse.json({
        success: true,
        stats: videoStats
      });
    }

    // Return videos by format
    if (format) {
      console.log('🎬 Getting videos by format:', format, 'for user:', clerkId);
      const videos = await getVideosByFormat(clerkId, format, { 
        includeData, 
        limit 
      });
      
      return NextResponse.json({
        success: true,
        videos,
        count: videos.length
      });
    }

    // Return user videos (default)
    console.log('🎬 Getting videos for user:', clerkId);
    const videos = await getUserVideos(clerkId, {
      includeData,
      jobId: jobId || undefined,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length
    });

  } catch (error) {
    console.error('💥 Error in videos API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get videos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const jobId = searchParams.get('jobId');

    if (!videoId && !jobId) {
      return NextResponse.json(
        { error: 'videoId or jobId parameter required' },
        { status: 400 }
      );
    }

    if (videoId) {
      // Delete single video
      const { deleteVideo } = await import('@/lib/videoStorage');
      const deleted = await deleteVideo(videoId, clerkId);
      
      if (!deleted) {
        return NextResponse.json(
          { error: 'Video not found or access denied' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Video deleted successfully'
      });
    }

    if (jobId) {
      // Delete all videos for a job
      const { deleteVideosByJobId } = await import('@/lib/videoStorage');
      const deletedCount = await deleteVideosByJobId(jobId, clerkId);
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} videos for job`,
        deletedCount
      });
    }

  } catch (error) {
    console.error('💥 Error deleting videos:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete videos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
