import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative';

/**
 * POST /api/s3/move-to-folder
 * Move a generated image/video to a different folder in S3
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { itemId, itemType, currentS3Key, targetFolderPrefix, filename } = body;

    // Validate inputs
    if (!itemId || !currentS3Key || !targetFolderPrefix || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify target folder belongs to user
    if (!targetFolderPrefix.startsWith(`outputs/${userId}/`)) {
      return NextResponse.json(
        { error: 'Unauthorized: Cannot move to folders outside your directory' },
        { status: 403 }
      );
    }

    console.log('📦 Moving item for user:', userId);
    console.log('📂 Current S3 key:', currentS3Key);
    console.log('📂 Target folder:', targetFolderPrefix);
    console.log('📄 Filename:', filename);

    // Check if source file exists
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: currentS3Key,
      });
      await s3Client.send(headCommand);
    } catch (error) {
      console.error('Source file not found:', error);
      return NextResponse.json(
        { error: 'Source file not found in S3' },
        { status: 404 }
      );
    }

    // Create new S3 key with target folder
    const newS3Key = `${targetFolderPrefix}${filename}`;

    console.log('🎯 New S3 key:', newS3Key);

    // Copy object to new location
    const copyCommand = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${currentS3Key}`,
      Key: newS3Key,
    });

    await s3Client.send(copyCommand);
    console.log('✅ File copied to new location');

    // Delete old object
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: currentS3Key,
    });

    await s3Client.send(deleteCommand);
    console.log('✅ Old file deleted');

    // Update database record
    const newS3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${newS3Key}`;

    if (itemType === 'image') {
      await prisma.generatedImage.update({
        where: { id: itemId },
        data: {
          awsS3Key: newS3Key,
          awsS3Url: newS3Url,
        },
      });
      console.log('✅ Image database record updated');
    } else if (itemType === 'video') {
      await prisma.generatedVideo.update({
        where: { id: itemId },
        data: {
          awsS3Key: newS3Key,
          awsS3Url: newS3Url,
        },
      });
      console.log('✅ Video database record updated');
    }

    return NextResponse.json({
      success: true,
      message: 'Item moved successfully',
      newS3Key,
      newS3Url,
    });

  } catch (error) {
    console.error('❌ Error moving item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to move item' },
      { status: 500 }
    );
  }
}
