import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the file from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;

    if (!file || !displayName) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, displayName' 
      }, { status: 400 });
    }

    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
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
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;

    console.log(`🚀 Starting direct S3 upload for ${file.name} (${Math.round(file.size / 1024 / 1024)}MB) via server proxy`);

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

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: '83cljmpqfd',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
      Metadata: {
        'original-name': file.name,
        'display-name': displayName,
        'user-id': userId,
        'upload-timestamp': timestamp.toString(),
      },
    });

    await s3Client.send(uploadCommand);

    console.log(`✅ Direct S3 upload completed: ${uniqueFileName}`);

    return NextResponse.json({
      success: true,
      uniqueFileName,
      s3Key,
      comfyUIPath: `/runpod-volume/loras/${userId}/${uniqueFileName}`,
      networkVolumePath: `s3://83cljmpqfd/${s3Key}`,
    });

  } catch (error) {
    console.error('❌ Error in direct S3 upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to S3' },
      { status: 500 }
    );
  }
}
