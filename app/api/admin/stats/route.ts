import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    await requireAdminAccess();

    // Fetch various statistics
    const [
      totalUsers,
      activeJobs,
      totalImages,
      totalVideos,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.generationJob.count({
        where: {
          status: {
            in: ['PENDING', 'PROCESSING']
          }
        }
      }),
      prisma.generatedImage.count(),
      prisma.generatedVideo.count(),
    ]);

    // Calculate total content
    const totalContent = totalImages + totalVideos;

    // Calculate storage used (simplified calculation)
    const imageData = await prisma.generatedImage.aggregate({
      _sum: {
        fileSize: true,
      },
    });

    const videoData = await prisma.generatedVideo.aggregate({
      _sum: {
        fileSize: true,
      },
    });

    const totalBytes = (imageData._sum.fileSize || 0) + (videoData._sum.fileSize || 0);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    const stats = {
      totalUsers,
      activeJobs,
      totalContent,
      storageUsed: `${totalGB} GB`,
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}