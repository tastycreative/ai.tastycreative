import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserVideos, getVideoStats } from '@/lib/videoStorage';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeData = searchParams.get('includeData') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const sortBy = searchParams.get('sortBy') as 'newest' | 'oldest' | 'largest' | 'smallest' | 'name' | null;
    const stats = searchParams.get('stats') === 'true';
    const requestedUserId = searchParams.get('userId'); // Admin can request another user's content
    const folder = searchParams.get('folder'); // Check if viewing a specific folder

    // Check if the requesting user is an admin
    let targetUserId = userId; // Default to current user
    if (requestedUserId) {
      // Import prisma
      const { prisma } = await import('@/lib/database');
      
      // Verify the requesting user is an admin
      const requestingUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true }
      });

      if (requestingUser?.role === 'ADMIN') {
        targetUserId = requestedUserId;
        console.log('🔑 Admin user requesting videos for userId:', requestedUserId);
      } else {
        console.warn('⚠️ Non-admin user attempted to access another user\'s videos');
        // Silently ignore the userId parameter for non-admins
      }
    }

    console.log('🎬 GET /api/videos:', {
      userId,
      targetUserId,
      includeData,
      limit,
      offset,
      sortBy,
      stats,
      folder
    });

    // Import prisma for folder share check and stats
    const { prisma: prismaClient } = await import('@/lib/database');

    // Check if user is viewing a shared folder
    let whereClause: any = { clerkId: targetUserId };
    let isSharedFolder = false;
    
    if (folder && folder !== 'all') {
      // Check if this folder is shared with the current user
      const folderShare = await prismaClient.folderShare.findFirst({
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

    // If stats are requested, return stats instead of videos
    if (stats) {
      // For shared folders, we need custom stats query
      if (isSharedFolder && folder) {
        const totalCount = await prismaClient.generatedVideo.count({
          where: whereClause
        });
        const totalSize = await prismaClient.generatedVideo.aggregate({
          where: whereClause,
          _sum: { fileSize: true }
        });
        return NextResponse.json({ 
          success: true, 
          stats: {
            totalVideos: totalCount,
            totalSize: totalSize._sum.fileSize || 0
          }
        });
      } else {
        const videoStats = await getVideoStats(targetUserId);
        return NextResponse.json({ success: true, stats: videoStats });
      }
    }

    // Get total count for pagination
    const totalCount = await prismaClient.generatedVideo.count({
      where: whereClause
    });

    // Get videos - use custom query for shared folders
    let videos;
    if (isSharedFolder && folder) {
      console.log('📡 Fetching shared folder videos with where clause:', whereClause);
      videos = await prismaClient.generatedVideo.findMany({
        where: whereClause,
        select: {
          id: true,
          filename: true,
          awsS3Key: true,
          fileSize: true,
          createdAt: true,
          data: includeData ? true : false
        },
        orderBy: sortBy === 'oldest' ? { createdAt: 'asc' } : 
                 sortBy === 'largest' ? { fileSize: 'desc' } : 
                 sortBy === 'smallest' ? { fileSize: 'asc' } : 
                 { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      // Format videos to match getUserVideos output
      videos = videos.map((vid: any) => ({
        id: vid.id,
        filename: vid.filename || 'Untitled',
        dataUrl: vid.data || null,
        awsS3Key: vid.awsS3Key,
        fileSize: vid.fileSize,
        createdAt: vid.createdAt
      }));
    } else {
      // Get user videos using the videoStorage function
      videos = await getUserVideos(targetUserId, {
        includeData,
        limit,
        offset,
        sortBy: sortBy || undefined
      });
    }

    return NextResponse.json({
      success: true,
      videos: videos,
      count: videos.length,
      total: totalCount,
      hasMore: offset !== undefined && limit !== undefined ? (offset + limit < totalCount) : false
    });

  } catch (error) {
    console.error('💥 Error in GET /api/videos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
