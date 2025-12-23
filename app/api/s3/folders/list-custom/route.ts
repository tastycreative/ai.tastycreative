import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

    const rootPrefix = `outputs/${userId}/`;
    const folderInfoKeys: string[] = [];

    let continuationToken: string | undefined;
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: rootPrefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);
      const contents = listResponse.Contents || [];

      for (const item of contents) {
        const key = item.Key || '';
        if (key.endsWith('.folderinfo')) {
          folderInfoKeys.push(key);
        }
      }

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);

    const formatFolderFromPrefix = (folderPrefix: string) => {
      const sanitizedPrefix = folderPrefix.replace(/\/+$/, '/') ;
      const parts = sanitizedPrefix.split('/').filter(Boolean);
      if (parts.length < 3) {
        return null;
      }

      if (`${parts[0]}/${parts[1]}/` !== rootPrefix) {
        return null;
      }

      const folderSlug = parts[parts.length - 1];
      const folderName = folderSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const parentParts = parts.slice(0, -1);
      const parentPrefix = parentParts.length <= 2 ? null : `${parentParts.join('/')}/`;
      const depth = parts.length - 2; // depth relative to user root
      const path = parts.slice(2).join('/');

      return {
        name: folderName,
        prefix: sanitizedPrefix,
        parentPrefix,
        depth,
        path,
      };
    };

    const customFolders = folderInfoKeys
      .map((key) => {
        const folderPrefix = key.replace(/\.folderinfo$/, '');
        return formatFolderFromPrefix(folderPrefix);
      })
      .filter((folder): folder is {
        name: string;
        prefix: string;
        parentPrefix: string | null;
        depth: number;
        path: string;
      } => folder !== null);

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
        const formatted = (() => {
          const prefix = share.folderPrefix.replace(/\/+$/, '/');
          const parts = prefix.split('/').filter(Boolean);
          if (parts.length < 3) {
            return {
              name: 'Unknown Folder',
              depth: 1,
              path: 'unknown',
              parentPrefix: null as string | null,
              sanitizedPrefix: prefix,
            };
          }

          const folderSlug = parts[parts.length - 1];
          const folderName = folderSlug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          const parentParts = parts.slice(0, -1);
          const parentPrefix = parentParts.length <= 2 ? null : `${parentParts.join('/')}/`;
          const depth = parts.length - 2;
          const path = parts.slice(2).join('/');

          return { name: folderName, depth, path, parentPrefix, sanitizedPrefix: prefix };
        })();

        return {
          name: formatted.name,
          prefix: formatted.sanitizedPrefix,
          isShared: true,
          sharedBy: ownerName,
          permission: share.permission,
          depth: formatted.depth,
          path: formatted.path,
          parentPrefix: formatted.parentPrefix,
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

    foldersWithCounts.sort((a, b) => {
      const pathA = a.path || a.name;
      const pathB = b.path || b.name;
      return pathA.localeCompare(pathB);
    });

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
