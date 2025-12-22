import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  S3Client, 
  ListObjectsV2Command, 
  DeleteObjectsCommand,
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID! || process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! || process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'tastycreative';

/**
 * DELETE /api/s3/folders/delete
 * Delete a custom folder (only if it's empty or user confirms)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { folderPrefix, force } = body;

    // Validate folder prefix
    if (!folderPrefix || typeof folderPrefix !== 'string') {
      return NextResponse.json(
        { error: 'Folder prefix is required' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting folder for user:', userId);
    console.log('📂 Folder prefix:', folderPrefix);

    // Verify this is the user's folder (prefix should be outputs/{userId}/...)
    if (!folderPrefix.startsWith(`outputs/${userId}/`)) {
      return NextResponse.json(
        { error: 'Unauthorized: Cannot delete folders outside your directory' },
        { status: 403 }
      );
    }

    // Delete all folder shares associated with this folder first
    try {
      const deletedShares = await prisma.folderShare.deleteMany({
        where: {
          folderPrefix: folderPrefix,
        },
      });
      console.log(`🗑️ Deleted ${deletedShares.count} folder share(s)`);
    } catch (error) {
      console.error('Error deleting folder shares:', error);
      // Continue with folder deletion even if share deletion fails
    }

    // List all objects in the folder
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folderPrefix,
    });

    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      // Delete the .folderinfo placeholder if it exists
      try {
        const placeholderKey = `${folderPrefix}.folderinfo`;
        const deleteCommand = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: placeholderKey,
        });
        await s3Client.send(deleteCommand);
      } catch (err) {
        // Ignore error if placeholder doesn't exist
        console.log('No placeholder to delete');
      }

      return NextResponse.json({
        success: true,
        message: 'Folder deleted successfully (was empty)',
        deletedCount: 0,
      });
    }

    // If folder has files and force is not set, return error
    if (!force) {
      return NextResponse.json(
        { 
          error: 'Folder is not empty', 
          fileCount: objects.length,
          message: 'Use force=true to delete folder with files'
        },
        { status: 400 }
      );
    }

    // Delete all objects in the folder
    const objectsToDelete = objects.map(obj => ({ Key: obj.Key! }));
    
    // S3 can delete max 1000 objects at a time
    const batchSize = 1000;
    let deletedCount = 0;

    for (let i = 0; i < objectsToDelete.length; i += batchSize) {
      const batch = objectsToDelete.slice(i, i + batchSize);
      
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: batch,
          Quiet: true,
        },
      });

      const deleteResponse = await s3Client.send(deleteCommand);
      deletedCount += batch.length - (deleteResponse.Errors?.length || 0);
    }

    // Delete the .folderinfo placeholder
    try {
      const placeholderKey = `${folderPrefix}.folderinfo`;
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: placeholderKey,
      });
      await s3Client.send(deleteCommand);
    } catch (err) {
      console.log('No placeholder to delete');
    }

    console.log(`✅ Deleted ${deletedCount} objects from S3 folder`);

    // Delete database records for images and videos in this folder
    try {
      console.log('🗑️ Deleting database records for folder content...');
      
      // Delete images where awsS3Key starts with the folder prefix
      const deletedImages = await prisma.generatedImage.deleteMany({
        where: {
          awsS3Key: {
            startsWith: folderPrefix,
          },
        },
      });
      console.log(`✅ Deleted ${deletedImages.count} image record(s) from database`);

      // Delete videos where awsS3Key starts with the folder prefix
      const deletedVideos = await prisma.generatedVideo.deleteMany({
        where: {
          awsS3Key: {
            startsWith: folderPrefix,
          },
        },
      });
      console.log(`✅ Deleted ${deletedVideos.count} video record(s) from database`);

      // Also delete records that might be stored with the old s3Key format
      const deletedImagesOld = await prisma.generatedImage.deleteMany({
        where: {
          s3Key: {
            startsWith: folderPrefix,
          },
        },
      });
      
      const deletedVideosOld = await prisma.generatedVideo.deleteMany({
        where: {
          s3Key: {
            startsWith: folderPrefix,
          },
        },
      });

      if (deletedImagesOld.count > 0 || deletedVideosOld.count > 0) {
        console.log(`✅ Deleted ${deletedImagesOld.count} old image record(s) and ${deletedVideosOld.count} old video record(s)`);
      }

    } catch (dbError) {
      console.error('❌ Error deleting database records:', dbError);
      // Continue even if database deletion fails
      // The S3 files are already deleted, which is the primary concern
    }

    console.log(`✅ Folder deletion complete: ${deletedCount} S3 objects deleted`);

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully',
      deletedCount,
    });

  } catch (error) {
    console.error('❌ Error deleting folder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
