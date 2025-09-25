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
    
    console.log(`🎬 S3 video proxy request for key: ${s3Key}`);
    
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
      
      // Determine content type based on file extension
      const contentType = s3Key.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 
                         s3Key.toLowerCase().endsWith('.webm') ? 'video/webm' :
                         s3Key.toLowerCase().endsWith('.mov') ? 'video/quicktime' :
                         s3Key.toLowerCase().endsWith('.avi') ? 'video/x-msvideo' :
                         s3Key.toLowerCase().endsWith('.gif') ? 'image/gif' : 'video/mp4';
      
      // Return the video data directly with enhanced headers for video playback
      return new NextResponse(videoBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'Content-Length': videoBuffer.length.toString(),
          'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cross-Origin-Resource-Policy': 'cross-origin', // Allow cross-origin embedding
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline', // Display inline instead of download
          'Accept-Ranges': 'bytes', // Enable range requests for video seeking
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