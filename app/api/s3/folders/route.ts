import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'tastycreative';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderPrefix = searchParams.get('prefix') || 'instagram/';

    console.log('📁 Listing S3 folder for user:', userId, 'prefix:', folderPrefix);

    // For "All Generations" (instagram/), we need to list files from ALL subfolders
    const isAllGenerations = folderPrefix === 'instagram/' || folderPrefix === 'instagram';
    
    let allFiles: any[] = [];
    
    if (isAllGenerations) {
      // List all Instagram subfolders and aggregate files
      const subfolders = ['instagram/posts/', 'instagram/reels/', 'instagram/misc/'];
      
      for (const subfolder of subfolders) {
        const userSubfolderPrefix = `${subfolder}${userId}/`;
        
        const command = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: userSubfolderPrefix,
          // No delimiter for recursive listing
        });

        const response = await s3Client.send(command);
        
        // Collect files from this subfolder
        const subfolderFiles = (response.Contents || [])
          .filter(item => {
            const key = item.Key || '';
            // Exclude the folder itself
            if (key === userSubfolderPrefix || key.endsWith('/')) return false;
            return true;
          })
          .map(item => {
            const key = item.Key || '';
            const fileName = key.split('/').pop() || '';
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
            const isVideo = /\.(mp4|mov|avi|webm)$/i.test(fileName);

            return {
              id: key,
              name: fileName,
              key: key,
              url: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
              size: item.Size || 0,
              lastModified: item.LastModified?.toISOString() || '',
              mimeType: isVideo ? 'video/mp4' : isImage ? 'image/jpeg' : 'application/octet-stream',
              isImage,
              isVideo,
            };
          });
        
        allFiles.push(...subfolderFiles);
      }
      
      // Sort by last modified (newest first)
      allFiles.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
      
      console.log(`✅ Found ${allFiles.length} total files across all Instagram folders for user ${userId}`);

      return NextResponse.json({
        success: true,
        prefix: folderPrefix,
        folders: [],
        files: allFiles,
      });
    }
    
    // For specific folders (not "All Generations")
    // Always include userId in the path for user isolation
    // This ensures users only see their own files
    const userFolderPrefix = `${folderPrefix}${userId}/`;
    
    // List objects in S3 with the given prefix (user-specific)
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: userFolderPrefix,
      Delimiter: '/', // Use delimiter for folder structure
    });

    const response = await s3Client.send(command);

    // Get subfolders (common prefixes) - only for non-recursive listings
    const folders = isAllGenerations ? [] : (response.CommonPrefixes || []).map(prefix => ({
      name: prefix.Prefix?.replace(userFolderPrefix, '').replace('/', '') || '',
      prefix: prefix.Prefix || '',
    }));

    // Get files in current folder
    const files = (response.Contents || [])
      .filter(item => {
        const key = item.Key || '';
        // Exclude the folder itself
        if (key === userFolderPrefix || key.endsWith('/')) return false;
        return true;
      })
      .map(item => {
        const key = item.Key || '';
        const fileName = key.split('/').pop() || '';
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(fileName);

        return {
          id: key,
          name: fileName,
          key: key,
          url: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
          size: item.Size || 0,
          lastModified: item.LastModified?.toISOString() || '',
          mimeType: isVideo ? 'video/mp4' : isImage ? 'image/jpeg' : 'application/octet-stream',
          isImage,
          isVideo,
        };
      });

    console.log(`✅ Found ${folders.length} folders and ${files.length} files for user ${userId}`);

    return NextResponse.json({
      success: true,
      prefix: folderPrefix,
      folders,
      files,
    });

  } catch (error) {
    console.error('❌ S3 folder listing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list S3 folder' },
      { status: 500 }
    );
  }
}
