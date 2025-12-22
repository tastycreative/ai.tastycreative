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
    
    console.log(`🎬 S3 video redirect request for key: ${s3Key}`);
    
    // For network volume videos, we can allow access without strict authentication
    // since the S3 keys are already scoped to user directories (outputs/userId/...)
    
    // Verify this is a valid S3 key format (should start with outputs/)
    if (!s3Key.startsWith('outputs/')) {
      console.error(`❌ Invalid S3 key format: ${s3Key}`);
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }
    
    // Generate signed URL for direct S3 access - NO PROXYING
    const s3Client = getS3Client();
    const bucketName = process.env.RUNPOD_S3_BUCKET_NAME || '83cljmpqfd';
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    try {
      console.log(`� Generating signed URL for direct access: ${bucketName}/${s3Key}`);
      
      // Generate signed URL for direct access (eliminates bandwidth usage)
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
      
      console.log(`✅ Generated signed URL, redirecting to direct S3 access`);
      
      // Redirect to signed URL for direct access
      return NextResponse.redirect(signedUrl);
      
    } catch (s3Error) {
      console.error('❌ Error generating signed URL:', s3Error);
      return NextResponse.json({ error: 'Failed to access video' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Error serving S3 video:', error);
    return NextResponse.json({ 
      error: 'Failed to serve video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}