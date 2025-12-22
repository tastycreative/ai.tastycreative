import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Upload Image] Starting upload for user:', clerkId);

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      console.error('[Upload Image] No file in form data');
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    console.log('[Upload Image] File received:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[Upload Image] Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.error('[Upload Image] File too large:', file.size);
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Check S3 configuration
    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      console.error('[Upload Image] AWS_S3_BUCKET_NAME not configured');
      return NextResponse.json(
        { error: 'Storage configuration missing' },
        { status: 500 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const s3Key = `feed-posts/${clerkId}/${uniqueFileName}`;

    console.log('[Upload Image] Generated S3 key:', s3Key);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[Upload Image] Buffer created, size:', buffer.length);

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

    console.log('[Upload Image] Uploading to S3...');
    await s3Client.send(uploadCommand);
    console.log('[Upload Image] Upload successful');

    // Construct the S3 URL
    const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    console.log('[Upload Image] Image URL:', imageUrl);

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: any) {
    console.error('[Upload Image] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
