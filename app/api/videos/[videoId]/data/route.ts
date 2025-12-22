import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getVideoData } from '@/lib/videoStorage';

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
    console.log('🎬 Serving video data for:', videoId, 'to user:', userId);

    // Get video data from database
    const videoData = await getVideoData(videoId, userId);
    
    if (!videoData) {
      console.error('❌ Video not found:', videoId);
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // If video is stored on S3, redirect to direct S3 URL (no proxy)
    if (videoData.s3Key) {
      console.log('🔄 Redirecting to direct S3 URL for video:', videoData.s3Key);
      
      // Import S3 client for direct URL generation
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({
        region: 'us-ks-2',
        endpoint: 'https://s3api-us-ks-2.runpod.io',
        credentials: {
          accessKeyId: process.env.RUNPOD_S3_ACCESS_KEY || '',
          secretAccessKey: process.env.RUNPOD_S3_SECRET_KEY || ''
        },
        forcePathStyle: true
      });
      
      const bucketName = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: videoData.s3Key
      });
      
      try {
        // Generate direct signed URL (eliminates bandwidth usage)
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log('✅ Generated direct S3 signed URL');
        return NextResponse.redirect(signedUrl);
      } catch (s3Error) {
        console.error('❌ Error generating direct S3 URL:', s3Error);
        // Fallback to proxy if direct URL fails
        const s3ProxyUrl = `/api/videos/s3/${encodeURIComponent(videoData.s3Key)}`;
        return NextResponse.redirect(new URL(s3ProxyUrl, request.url));
      }
    }

    // Legacy: Handle blob data videos
    if (!videoData.data || videoData.data.length === 0) {
      console.error('❌ No video data found for:', videoId);
      return NextResponse.json(
        { error: 'Video data not found' },
        { status: 404 }
      );
    }

    console.log('✅ Serving legacy blob video:', {
      filename: videoData.filename,
      format: videoData.format,
      size: videoData.data.length
    });

    // Determine content type based on format or filename
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
          contentType = 'video/x-msvideo';
          break;
        case 'mov':
          contentType = 'video/quicktime';
          break;
        default:
          contentType = 'video/mp4';
      }
    } else {
      // Fallback: determine from filename extension
      const extension = videoData.filename.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'mp4':
          contentType = 'video/mp4';
          break;
        case 'webm':
          contentType = 'video/webm';
          break;
        case 'avi':
          contentType = 'video/x-msvideo';
          break;
        case 'mov':
          contentType = 'video/quicktime';
          break;
      }
    }

    // Return video data with proper headers
    return new NextResponse(new Uint8Array(videoData.data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoData.data.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Disposition': `inline; filename="${videoData.filename}"`,
        'Accept-Ranges': 'bytes', // Enable range requests for video seeking
      },
    });

  } catch (error) {
    console.error('💥 Error serving video data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
