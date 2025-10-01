import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJobVideos } from '@/lib/videoStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    console.log('🎬 Getting videos for job:', jobId);

    // Get videos for job
    const videos = await getJobVideos(jobId, { includeData: false });
    
    console.log(`📊 Found ${videos.length} videos for job ${jobId}`);

    return NextResponse.json({
      success: true,
      videos: videos.map(video => ({
        id: video.id,
        filename: video.filename,
        subfolder: video.subfolder,
        type: video.type,
        fileSize: video.fileSize,
        width: video.width,
        height: video.height,
        duration: video.duration,
        fps: video.fps,
        format: video.format,
        createdAt: video.createdAt,
        url: video.url,        // ComfyUI direct URL (if available)
        dataUrl: video.dataUrl, // Database-served URL
        // AWS S3 fields for direct access
        awsS3Key: video.awsS3Key,
        awsS3Url: video.awsS3Url,
        s3Key: video.s3Key,
        networkVolumePath: video.networkVolumePath
      })),
      count: videos.length
    });

  } catch (error) {
    console.error('❌ Job videos error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
