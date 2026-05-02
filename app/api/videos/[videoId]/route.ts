import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/clerk-compat";
import { getUserVideos, deleteVideo } from '@/lib/videoStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
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

    const { videoId } = await params;
    console.log('📹 GET /api/videos/[videoId]:', videoId, 'for user:', userId);

    // Get all user videos and find the specific one
    const videos = await getUserVideos(userId, { includeData: false });
    const video = videos.find(v => v.id === videoId);
    
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: video
    });

  } catch (error) {
    console.error('💥 Error in GET /api/videos/[videoId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
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

    const { videoId } = await params;
    console.log('🗑️ DELETE /api/videos/[videoId]:', videoId, 'for user:', userId);

    // Delete the video
    const success = await deleteVideo(videoId, userId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Video not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully'
    });

  } catch (error) {
    console.error('💥 Error in DELETE /api/videos/[videoId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
