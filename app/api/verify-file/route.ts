import { NextRequest, NextResponse } from 'next/server';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    const userId = searchParams.get('userId') || 'user_30dULT8ZLO1jthhCEgn349cKcvT'; // Default to your user ID

    if (!fileName) {
      return NextResponse.json({ error: 'fileName parameter required' }, { status: 400 });
    }

    console.log(`🔍 Verifying file in network volume: ${fileName} for user: ${userId}`);

    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NextResponse.json({ error: 'S3 credentials not configured' }, { status: 500 });
    }

    // Create S3 client
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    const s3Key = `loras/${userId}/${fileName}`;
    console.log(`📍 Checking S3 key: ${s3Key}`);

    // Check if file exists in network volume
    const headCommand = new HeadObjectCommand({
      Bucket: '83cljmpqfd',
      Key: s3Key,
    });

    const result = await s3Client.send(headCommand);
    
    console.log(`✅ File verified in network volume: ${s3Key}`);
    console.log(`📊 File size: ${result.ContentLength} bytes`);

    return NextResponse.json({
      success: true,
      file_exists: true,
      s3Key: s3Key,
      bucket: '83cljmpqfd',
      file_size: result.ContentLength,
      file_size_mb: Math.round((result.ContentLength || 0) / 1024 / 1024),
      last_modified: result.LastModified,
      content_type: result.ContentType,
      metadata: result.Metadata,
      networkVolumePath: `/runpod-volume/${s3Key}`,
      serverlessPath: `/runpod-volume/loras/${userId}/${fileName}`,
      message: '✅ File verified in network volume storage - accessible by serverless pods!'
    });

  } catch (error) {
    console.error('❌ File verification failed:', error);
    
    // Check if it's a "not found" error vs other errors
    const isNotFound = error instanceof Error && error.message.includes('NotFound');
    
    return NextResponse.json(
      { 
        success: false,
        file_exists: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        is_not_found: isNotFound,
        message: isNotFound ? 'File not found in network volume' : 'Network volume access error'
      },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
