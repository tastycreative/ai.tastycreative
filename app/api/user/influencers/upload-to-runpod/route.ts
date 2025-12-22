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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!displayName) {
      return NextResponse.json({ error: 'No display name provided' }, { status: 400 });
    }

    // Check file size limit (6MB for Vercel serverless functions)
    const maxSizeBytes = 6 * 1024 * 1024; // 6MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is 6MB. Your file is ${Math.round(file.size / 1024 / 1024)}MB. Please use a smaller file or contact support for large file uploads.`,
        code: 'FILE_TOO_LARGE',
        maxSize: '6MB',
        actualSize: `${Math.round(file.size / 1024 / 1024)}MB`
      }, { status: 413 });
    }

    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .safetensors, .pt, and .ckpt files are allowed.' 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;

    console.log(`🎯 Uploading LoRA to network volume: ${uniqueFileName}`);
    console.log(`📁 File size: ${Math.round(file.size / 1024 / 1024)}MB`);

    // Upload directly to network volume storage via S3
    const S3_ACCESS_KEY = process.env.RUNPOD_S3_ACCESS_KEY;
    const S3_SECRET_KEY = process.env.RUNPOD_S3_SECRET_KEY;

    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      throw new Error('S3 credentials not configured');
    }

    console.log('�️ Uploading to network volume via S3...');

    // Create S3 client for RunPod network volume
    const s3Client = new S3Client({
      region: 'us-ks-2',
      endpoint: 'https://s3api-us-ks-2.runpod.io',
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    // Create the S3 key path for user-specific LoRA storage
    // This will be accessible to your serverless pod at /runpod-volume/loras/{userId}/
    const s3Key = `loras/${userId}/${uniqueFileName}`;

    console.log(`📤 Uploading to S3 key: ${s3Key}`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to network volume via S3
    const uploadCommand = new PutObjectCommand({
      Bucket: '83cljmpqfd',
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        'original-filename': file.name,
        'display-name': displayName,
        'user-id': userId,
        'upload-timestamp': Date.now().toString(),
      },
    });

    await s3Client.send(uploadCommand);
    
    console.log(`✅ Network volume upload successful: s3://83cljmpqfd/${s3Key}`);

    return NextResponse.json({
      success: true,
      fileName: uniqueFileName,
      s3Key: s3Key,
      networkVolumePath: `/runpod-volume/${s3Key}`,
      serverlessPath: `/runpod-volume/loras/${userId}/${uniqueFileName}`,
      bucketName: '83cljmpqfd',
      message: 'LoRA uploaded to network volume storage - accessible by serverless pods',
      uploadLocation: 'network_volume_s3',
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
