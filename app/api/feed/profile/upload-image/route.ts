// app\api\feed\profile\upload-image\route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
  credentials: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID! || process.env.S3_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! || process.env.S3_SECRET_ACCESS_KEY!,
  },
});

// POST - Upload profile or cover image
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Profile Upload] Starting upload for user:', clerkId);

    const formData = await request.formData();
    const image = formData.get('image') as File;
    const type = formData.get('type') as string; // 'profile' or 'cover'

    if (!image) {
      console.error('[Profile Upload] No image in form data');
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    console.log('[Profile Upload] File received:', {
      name: image.name,
      type: image.type,
      size: image.size,
      uploadType: type,
    });

    if (!['profile', 'cover'].includes(type)) {
      console.error('[Profile Upload] Invalid type:', type);
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(image.type)) {
      console.error('[Profile Upload] Invalid file type:', image.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (image.size > maxSize) {
      console.error('[Profile Upload] File too large:', image.size);
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      console.error('[Profile Upload] User not found:', clerkId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check S3 configuration
  const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
    if (!bucketName) {
      console.error('[Profile Upload] AWS_S3_BUCKET_NAME not configured');
      return NextResponse.json(
        { error: 'Storage configuration missing' },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('[Profile Upload] Buffer created, size:', buffer.length);

    // Generate unique filename
    const fileExtension = image.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const s3Key = `profile/${type}/${user.id}/${uniqueFilename}`;

    console.log('[Profile Upload] Generated S3 key:', s3Key);

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: image.type,
      Metadata: {
        originalName: image.name,
        uploadedBy: clerkId,
        uploadType: type,
      },
    });

    console.log('[Profile Upload] Uploading to S3...');
    await s3Client.send(uploadCommand);
    console.log('[Profile Upload] Upload successful');

  const imageUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    console.log('[Profile Upload] Image URL:', imageUrl);

    // Update user record based on type
    if (type === 'profile') {
      await prisma.user.update({
        where: { clerkId },
        data: { imageUrl },
      });
      console.log('[Profile Upload] Updated profile image');
    } else if (type === 'cover') {
      await prisma.user.update({
        where: { clerkId },
        data: { coverImageUrl: imageUrl },
      });
      console.log('[Profile Upload] Updated cover image');
    }

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: any) {
    console.error('[Profile Upload] Error details:', {
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
