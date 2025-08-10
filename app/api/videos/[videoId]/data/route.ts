// app/api/videos/[videoId]/data/route.ts - Serve video data from database
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getVideoData } from '@/lib/videoStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { videoId } = await params;
    console.log('📤 Serving video data:', videoId, 'for user:', clerkId);
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId parameter' },
        { status: 400 }
      );
    }
    
    const videoData = await getVideoData(videoId, clerkId);
    
    if (!videoData) {
      return NextResponse.json(
        { error: 'Video not found or no data available' },
        { status: 404 }
      );
    }
    
    console.log('✅ Serving video:', videoData.filename, 'Size:', videoData.data.length, 'bytes');
    
    // Determine content type based on format/filename
    let contentType = 'video/mp4'; // default
    if (videoData.format) {
      switch (videoData.format.toLowerCase()) {
        case 'mp4':
          contentType = 'video/mp4';
          break;
        case 'webm':
          contentType = 'video/webm';
          break;
        case 'avi':
          contentType = 'video/avi';
          break;
        case 'mov':
          contentType = 'video/mov';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        default:
          // Try to guess from filename
          if (videoData.filename.endsWith('.webm')) {
            contentType = 'video/webm';
          } else if (videoData.filename.endsWith('.avi')) {
            contentType = 'video/avi';
          } else if (videoData.filename.endsWith('.mov')) {
            contentType = 'video/mov';
          } else if (videoData.filename.endsWith('.gif')) {
            contentType = 'image/gif';
          }
      }
    }
    
    // Return video data as response with proper headers for streaming
    return new NextResponse(videoData.data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoData.data.length.toString(),
        'Content-Disposition': `inline; filename="${videoData.filename}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Last-Modified': new Date().toUTCString(),
        // Additional headers for video streaming
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Content-Transfer-Encoding': 'binary'
      }
    });
    
  } catch (error) {
    console.error('💥 Error serving video data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to serve video data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}