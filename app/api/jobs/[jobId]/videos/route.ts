// app/api/jobs/[jobId]/videos/route.ts - Get videos for a specific job
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserVideos } from '@/lib/videoStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { jobId } = params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    console.log('🎬 Getting videos for job:', jobId, 'user:', clerkId);

    const { searchParams } = new URL(request.url);
    const includeData = searchParams.get('includeData') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    // Get videos for this specific job
    const videos = await getUserVideos(clerkId, {
      includeData,
      jobId,
      limit,
      offset
    });

    console.log(`📊 Found ${videos.length} videos for job ${jobId}`);

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
      jobId
    });

  } catch (error) {
    console.error('💥 Error getting videos for job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get job videos',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
