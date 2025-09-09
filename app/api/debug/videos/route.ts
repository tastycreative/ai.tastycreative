import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const videos = await prisma.generatedVideo.findMany({
      select: {
        id: true,
        clerkId: true,
        jobId: true,
        filename: true,
        type: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      success: true,
      totalVideos: videos.length,
      videos
    });

  } catch (error) {
    console.error('Error in debug videos endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
