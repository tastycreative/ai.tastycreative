import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      itemId,
      itemType,
      driveFileId,
      folderName,
      s3Key,
      s3Url,
    } = body;

    console.log('📤 Update Storage Sync Request:', {
      itemId,
      itemType,
      driveFileId,
      folderName,
      s3Key,
      s3Url,
      userId,
    });

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId and itemType' },
        { status: 400 }
      );
    }

    if (!driveFileId && !s3Key) {
      return NextResponse.json(
        { error: 'Missing required storage identifier (driveFileId or s3Key)' },
        { status: 400 }
      );
    }

    // Update the appropriate table based on itemType (case-insensitive)
    const normalizedType = itemType.toUpperCase();
  const storageIdentifier = driveFileId || s3Key;
    const now = new Date();
    
    if (normalizedType === 'IMAGE') {
      const image = await prisma.generatedImage.findUnique({
        where: { id: itemId },
        select: { clerkId: true }
      });

      if (!image) {
        console.error('❌ Image not found:', itemId);
        return NextResponse.json(
          { error: 'Image not found' },
          { status: 404 }
        );
      }

      if (image.clerkId !== userId) {
        console.error('❌ Access denied for image:', itemId, 'User:', userId);
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      await prisma.generatedImage.update({
        where: { id: itemId },
        data: {
          googleDriveFileId: storageIdentifier,
          googleDriveFolderName: folderName || null,
          googleDriveUploadedAt: now,
        }
      });

      console.log('✅ Updated image Drive sync:', itemId);
    } else if (normalizedType === 'VIDEO') {
      const video = await prisma.generatedVideo.findUnique({
        where: { id: itemId },
        select: { clerkId: true }
      });

      if (!video) {
        console.error('❌ Video not found:', itemId);
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }

      if (video.clerkId !== userId) {
        console.error('❌ Access denied for video:', itemId, 'User:', userId);
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      await prisma.generatedVideo.update({
        where: { id: itemId },
        data: {
          googleDriveFileId: storageIdentifier,
          googleDriveFolderName: folderName || null,
          googleDriveUploadedAt: now,
        }
      });

      console.log('✅ Updated video Drive sync:', itemId);
    } else {
      console.error('❌ Invalid itemType:', itemType);
      return NextResponse.json(
        { error: `Invalid itemType: ${itemType}. Must be IMAGE or VIDEO` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Storage sync status updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating storage sync status:', error);
    return NextResponse.json(
      { error: 'Failed to update storage sync status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
