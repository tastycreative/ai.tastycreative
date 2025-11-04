import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserImages } from '@/lib/imageStorage';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stats = searchParams.get('stats');
    const includeData = searchParams.get('includeData') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const sortBy = searchParams.get('sortBy') as 'newest' | 'oldest' | 'largest' | 'smallest' | 'name' | null;
    const requestedUserId = searchParams.get('userId'); // Admin can request another user's content
    const folder = searchParams.get('folder'); // Check if viewing a specific folder

    // Check if the requesting user is an admin
    let targetUserId = userId; // Default to current user
    if (requestedUserId) {
      // Verify the requesting user is an admin
      const requestingUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });

      if (requestingUser?.role === 'ADMIN') {
        targetUserId = requestedUserId;
        console.log('🔑 Admin user requesting content for userId:', requestedUserId);
      } else {
        console.warn('⚠️ Non-admin user attempted to access another user\'s content');
        // Silently ignore the userId parameter for non-admins
      }
    }

    console.log('🔍 API /images called by user:', userId, 'targetUserId:', targetUserId, 'stats:', stats, 'includeData:', includeData, 'folder:', folder);

    // Check if user is viewing a shared folder
    let whereClause: any = { clerkId: targetUserId };
    let isSharedFolder = false;
    
    if (folder && folder !== 'all') {
      // Check if this folder is shared with the current user
      const folderShare = await prisma.folderShare.findFirst({
        where: {
          folderPrefix: folder,
          sharedWithClerkId: userId
        }
      });

      if (folderShare) {
        // User has access to this shared folder, filter by folder prefix
        console.log('📂 User viewing shared folder:', folder);
        isSharedFolder = true;
        whereClause = {
          awsS3Key: {
            startsWith: folder
          }
        };
      } else if (userId === targetUserId) {
        // User viewing their own folder
        console.log('📂 User viewing own folder:', folder);
        whereClause = {
          clerkId: targetUserId,
          awsS3Key: {
            startsWith: folder
          }
        };
      }
    }

    if (stats === 'true') {
      // Get actual image statistics from database
      try {
        const [totalImages, imagesWithData, totalSize] = await Promise.all([
          prisma.generatedImage.count({
            where: whereClause
          }),
          prisma.generatedImage.count({
            where: { 
              ...whereClause,
              data: { not: null }
            }
          }),
          prisma.generatedImage.aggregate({
            where: whereClause,
            _sum: { fileSize: true }
          })
        ]);

        // Get format breakdown
        const formatBreakdown = await prisma.generatedImage.groupBy({
          by: ['format'],
          where: whereClause,
          _count: { format: true }
        });

        const formatCounts = formatBreakdown.reduce((acc, item) => {
          if (item.format) {
            acc[item.format] = item._count.format;
          }
          return acc;
        }, {} as Record<string, number>);

        const imageStats = {
          success: true,
          stats: {
            totalImages: totalImages || 0,
            totalSize: totalSize._sum.fileSize || 0,
            formatBreakdown: formatCounts,
            imagesWithData: imagesWithData || 0,
            imagesWithoutData: (totalImages || 0) - (imagesWithData || 0)
          }
        };

        console.log('📊 Returning image stats:', imageStats.stats);
        return NextResponse.json(imageStats);
      } catch (error) {
        console.error('Error fetching image stats:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch image statistics'
        }, { status: 500 });
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.generatedImage.count({
      where: whereClause
    });

    // Get images - use custom query for shared folders
    let images;
    if (isSharedFolder && folder) {
      console.log('📡 Fetching shared folder images with where clause:', whereClause);
      images = await prisma.generatedImage.findMany({
        where: whereClause,
        select: {
          id: true,
          filename: true,
          awsS3Key: true,
          fileSize: true,
          createdAt: true,
          format: true,
          data: includeData ? true : false
        },
        orderBy: sortBy === 'oldest' ? { createdAt: 'asc' } : 
                 sortBy === 'largest' ? { fileSize: 'desc' } : 
                 sortBy === 'smallest' ? { fileSize: 'asc' } : 
                 { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      // Format images to match getUserImages output
      images = images.map((img: any) => ({
        id: img.id,
        filename: img.filename || 'Untitled',
        dataUrl: img.data || null,
        url: null,
        awsS3Key: img.awsS3Key,
        fileSize: img.fileSize,
        format: img.format,
        createdAt: img.createdAt
      }));
    } else {
      // Get user images using the imageStorage function
      console.log('📡 Fetching user images with options:', { includeData, limit, offset, sortBy });
      images = await getUserImages(targetUserId, {
        includeData,
        limit,
        offset,
        sortBy: sortBy || undefined
      });
    }

    console.log('✅ Found', images.length, 'images for user:', targetUserId, '(total:', totalCount, ')');
    if (images.length > 0) {
      console.log('📸 Sample image:', {
        id: images[0].id,
        filename: images[0].filename,
        hasDataUrl: !!images[0].dataUrl,
        hasUrl: !!images[0].url,
        dataUrl: images[0].dataUrl,
        url: images[0].url
      });
    }

    return NextResponse.json({ 
      success: true,
      images: images,
      total: totalCount,
      hasMore: offset !== undefined && limit !== undefined ? (offset + limit < totalCount) : false
    });

  } catch (error) {
    console.error('Error fetching image data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
