import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/database';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative';

/**
 * GET /api/s3/folders/list-custom
 * List all custom folders created by the user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📁 Listing custom folders for user:', userId);

    // List all folders under outputs/{userId}/ prefix
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `outputs/${userId}/`,
      Delimiter: '/',
    });

    const response = await s3Client.send(command);
    const commonPrefixes = response.CommonPrefixes || [];

    // Get all folders under user's outputs directory
    const customFolders = commonPrefixes
      .map((prefix) => {
        const folderPrefix = prefix.Prefix || '';
        // Extract folder name from prefix: outputs/{userId}/{folder-name}/
        const parts = folderPrefix.split('/').filter(Boolean);
        if (parts.length < 3) return null; // Skip if not properly formatted
        
        const folderSlug = parts[2]; // The folder name part
        const folderName = folderSlug
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return {
          name: folderName,
          prefix: folderPrefix,
        };
      })
      .filter((folder): folder is { name: string; prefix: string } => folder !== null);

    console.log(`✅ Found ${customFolders.length} custom folders for user ${userId}`);

    // Get folders shared with this user
    const sharedFolders = await prisma.folderShare.findMany({
      where: {
        sharedWithClerkId: userId,
      },
    });

    console.log(`✅ Found ${sharedFolders.length} shared folders for user ${userId}`);
    if (sharedFolders.length > 0) {
      console.log('Shared folders:', sharedFolders.map(f => ({ 
        prefix: f.folderPrefix, 
        owner: f.ownerClerkId,
        permission: f.permission 
      })));
    }

    // Get folders this user has shared with others (to mark them)
    const foldersSharedByUser = await prisma.folderShare.findMany({
      where: {
        ownerClerkId: userId,
      },
      select: {
        folderPrefix: true,
      },
    });

    const sharedFolderPrefixes = new Set(foldersSharedByUser.map(f => f.folderPrefix));

    // Get owner info and format shared folders
    const sharedFoldersFormatted = await Promise.all(
      sharedFolders.map(async (share) => {
        const owner = await prisma.user.findUnique({
          where: { clerkId: share.ownerClerkId },
          select: { firstName: true, lastName: true, email: true },
        });

        const ownerName = owner?.firstName && owner?.lastName 
          ? `${owner.firstName} ${owner.lastName}`
          : owner?.firstName || owner?.lastName || owner?.email || 'Unknown';

        // Extract folder name from prefix (e.g., "outputs/user_123/nov-2/" -> "nov-2")
        const parts = share.folderPrefix.split('/').filter(Boolean);
        const folderSlug = parts[2] || 'unknown';
        const folderName = folderSlug
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return {
          name: folderName,
          prefix: share.folderPrefix,
          isShared: true,
          sharedBy: ownerName,
          permission: share.permission,
        };
      })
    );

    // Combine owned and shared folders
    const allFolders = [
      ...customFolders.map(f => ({ 
        ...f, 
        isShared: false,
        hasShares: sharedFolderPrefixes.has(f.prefix), // Mark if this folder is shared with others
      })),
      ...sharedFoldersFormatted,
    ];

    // Get file count for each folder
    const foldersWithCounts = await Promise.all(
      allFolders.map(async (folder) => {
        try {
          const countCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: folder.prefix,
            MaxKeys: 1000, // Limit for performance
          });
          
          const countResponse = await s3Client.send(countCommand);
          const fileCount = (countResponse.Contents || []).filter(
            item => !item.Key?.endsWith('/') && !item.Key?.endsWith('.folderinfo')
          ).length;

          return {
            ...folder,
            fileCount,
          };
        } catch (error) {
          console.error(`Error counting files for folder ${folder.prefix}:`, error);
          return folder;
        }
      })
    );

    return NextResponse.json({
      success: true,
      folders: foldersWithCounts,
    });

  } catch (error) {
    console.error('❌ Error listing custom folders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list custom folders' },
      { status: 500 }
    );
  }
}
