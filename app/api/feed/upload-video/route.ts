import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
  credentials: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID! || process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! || process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Upload Video] Starting upload for user:', clerkId);

    const formData = await request.formData();
    const file = formData.get('video') as File;

    if (!file) {
      console.error('[Upload Video] No file in form data');
      return NextResponse.json({ error: 'No video provided' }, { status: 400 });
    }

    console.log('[Upload Video] File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[Upload Video] Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only MP4, WebM, MOV, and AVI are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      console.error('[Upload Video] File too large:', file.size);
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 400 }
      );
    }

    // Check S3 configuration
    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      console.error('[Upload Video] AWS_S3_BUCKET_NAME not configured');
      return NextResponse.json(
        { error: 'Storage configuration missing' },
        { status: 500 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const s3Key = `feed-videos/${clerkId}/${uniqueFileName}`;

    console.log('[Upload Video] Generated S3 key:', s3Key);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[Upload Video] Buffer created, size:', buffer.length);

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedBy: clerkId,
      },
    });

    console.log('[Upload Video] Uploading to S3...');
    await s3Client.send(uploadCommand);
    console.log('[Upload Video] Upload successful');

    // Construct the S3 URL
  const videoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    console.log('[Upload Video] Video URL:', videoUrl);

    return NextResponse.json({ videoUrl }, { status: 200 });
  } catch (error: any) {
    console.error('[Upload Video] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to upload video' },
      { status: 500 }
    );
  }
}
