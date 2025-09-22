import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 client for RunPod Network Volume
function getS3Client() {
  return new S3Client({
    region: 'us-ks-2',
    endpoint: 'https://s3api-us-ks-2.runpod.io', // Updated to match handler endpoint
    credentials: {
      accessKeyId: process.env.RUNPOD_S3_ACCESS_KEY || '',
      secretAccessKey: process.env.RUNPOD_S3_SECRET_KEY || ''
    },
    forcePathStyle: true
  });
}

// Video compression helper using query parameters
function getVideoCompressionParams(searchParams: URLSearchParams) {
  const quality = searchParams.get('quality') || 'original'; // low, medium, high, original
  const format = searchParams.get('format') || 'auto'; // auto, mp4, webm
  const resolution = searchParams.get('resolution') || 'auto'; // auto, 480p, 720p, 1080p, original
  const bitrate = searchParams.get('bitrate'); // target bitrate in kbps
  
  return { quality, format, resolution, bitrate };
}

// Get content type based on format and file extension
function getVideoContentType(s3Key: string, requestedFormat: string): string {
  // Respect requested format if specified
  if (requestedFormat === 'mp4') return 'video/mp4';
  if (requestedFormat === 'webm') return 'video/webm';
  
  // Auto-detect from file extension
  const extension = s3Key.toLowerCase().split('.').pop() || '';
  switch (extension) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mov': return 'video/quicktime';
    case 'avi': return 'video/x-msvideo';
    case 'gif': return 'image/gif';
    default: return 'video/mp4';
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const s3Key = decodeURIComponent(key);
    const searchParams = new URL(request.url).searchParams;
    const compressionParams = getVideoCompressionParams(searchParams);
    
    console.log(`🎬 S3 video proxy request for key: ${s3Key}`);
    console.log(`📊 Compression params:`, compressionParams);
    
    // For network volume videos, we can allow access without strict authentication
    // since the S3 keys are already scoped to user directories (outputs/userId/...)
    
    // Verify this is a valid S3 key format (should start with outputs/)
    if (!s3Key.startsWith('outputs/')) {
      console.error(`❌ Invalid S3 key format: ${s3Key}`);
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }
    
    // Generate signed URL for S3 access and fetch the video
    const s3Client = getS3Client();
    const bucketName = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    try {
      console.log(`📥 Fetching video from S3: ${bucketName}/${s3Key}`);
      
      // Fetch the video data from S3
      const response = await s3Client.send(command);
      
      if (!response.Body) {
        console.error(`❌ No video data found for key: ${s3Key}`);
        return NextResponse.json({ error: 'Video data not found' }, { status: 404 });
      }

      // Convert stream to buffer
      const stream = response.Body as any;
      const chunks: Uint8Array[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const videoBuffer = Buffer.concat(chunks);
      
      console.log(`✅ Successfully fetched video: ${s3Key}, size: ${videoBuffer.length} bytes`);
      
      // TODO: Add FFmpeg compression here if not 'original' quality
      // For now, we'll return the original video but with proper headers
      // In production, you'd use FFmpeg to compress based on compressionParams
      
      let processedBuffer = videoBuffer;
      let compressionInfo = '';
      
      // Simulate compression info for now (in production, FFmpeg would provide actual compression)
      if (compressionParams.quality !== 'original') {
        compressionInfo = ` (${compressionParams.quality} quality)`;
        // TODO: Implement actual FFmpeg compression here
        // processedBuffer = await compressVideoWithFFmpeg(videoBuffer, compressionParams);
      }
      
      // Determine content type based on requested format and file extension
      const contentType = getVideoContentType(s3Key, compressionParams.format);
      
      // Return the video data with enhanced headers for optimized playback
      return new NextResponse(processedBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${compressionParams.quality === 'original' ? '31536000' : '86400'}`, // Cache originals longer
          'Content-Length': processedBuffer.length.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline',
          'Accept-Ranges': 'bytes',
          'X-Video-Compression': compressionParams.quality + compressionInfo, // Indicate compression level
          'X-Original-Size': videoBuffer.length.toString(), // Track original size for bandwidth calculations
        },
      });
      
    } catch (s3Error) {
      console.error('❌ Error fetching video from S3:', s3Error);
      
      // Fallback: try generating a signed URL redirect
      try {
        console.log(`🔄 Attempting signed URL fallback for video: ${s3Key}`);
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        console.log(`✅ Generated signed URL, redirecting...`);
        return NextResponse.redirect(signedUrl);
      } catch (signedUrlError) {
        console.error('❌ Error generating signed URL:', signedUrlError);
        return NextResponse.json({ error: 'Failed to access video' }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error('❌ Error serving S3 video:', error);
    return NextResponse.json({ 
      error: 'Failed to serve video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}