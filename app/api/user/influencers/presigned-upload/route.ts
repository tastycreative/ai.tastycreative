import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { fileName, fileSize, displayName } = body;

    if (!fileName || !fileSize || !displayName) {
      return NextResponse.json({ 
        error: 'Missing required fields: fileName, fileSize, displayName' 
      }, { status: 400 });
    }

    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .safetensors, .pt, and .ckpt files are allowed.' 
      }, { status: 400 });
    }

    // Check environment variables
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      return NextResponse.json({ 
        error: 'S3 credentials not configured' 
      }, { status: 500 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${fileName}`;

    // Configure S3 client for RunPod network volume
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    // S3 key for network volume
    const s3Key = `loras/${userId}/${uniqueFileName}`;

    // Create presigned URL for PUT operation
    const putCommand = new PutObjectCommand({
      Bucket: '83cljmpqfd',
      Key: s3Key,
      ContentType: 'application/octet-stream',
      Metadata: {
        'original-name': fileName,
        'display-name': displayName,
        'user-id': userId,
        'upload-timestamp': timestamp.toString(),
      },
    });

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, putCommand, { 
      expiresIn: 3600 // 1 hour
    });

    console.log(`✅ Generated presigned URL for: ${uniqueFileName}`);

    return NextResponse.json({
      success: true,
      presignedUrl,
      uniqueFileName,
      s3Key,
      comfyUIPath: `/runpod-volume/loras/${userId}/${uniqueFileName}`,
      networkVolumePath: `s3://83cljmpqfd/${s3Key}`,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('❌ Error generating presigned URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
