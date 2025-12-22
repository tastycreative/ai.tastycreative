import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

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

    // Get recent videos for this user
    const videos = await prisma.generatedVideo.findMany({
      where: {
        clerkId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        jobId: true,
        filename: true,
        subfolder: true,
        type: true,
        fileSize: true,
        width: true,
        height: true,
        duration: true,
        format: true,
        createdAt: true,
        data: false, // Don't return the actual video data, just check if it exists
      }
    });

    // Check which videos have data
    const videoInfo = await Promise.all(videos.map(async (video) => {
      const videoWithData = await prisma.generatedVideo.findUnique({
        where: { id: video.id },
        select: { 
          data: true 
        }
      });
      
      return {
        ...video,
        hasData: !!videoWithData?.data,
        dataSize: videoWithData?.data ? videoWithData.data.length : 0,
        dataUrl: `/api/videos/${video.id}/data`,
        comfyUIUrl: `/api/proxy/comfyui/view?filename=${encodeURIComponent(video.filename)}&subfolder=${encodeURIComponent(video.subfolder || '')}&type=${encodeURIComponent(video.type || 'output')}`
      };
    }));

    return NextResponse.json({
      success: true,
      videos: videoInfo,
      totalCount: videos.length
    });

  } catch (error) {
    console.error('💥 Error checking videos:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
