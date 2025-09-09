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

    console.log('🔍 API /images called by user:', userId, 'stats:', stats, 'includeData:', includeData);

    if (stats === 'true') {
      // Get actual image statistics from database
      try {
        const [totalImages, imagesWithData, totalSize] = await Promise.all([
          prisma.generatedImage.count({
            where: { clerkId: userId }
          }),
          prisma.generatedImage.count({
            where: { 
              clerkId: userId,
              data: { not: null }
            }
          }),
          prisma.generatedImage.aggregate({
            where: { clerkId: userId },
            _sum: { fileSize: true }
          })
        ]);

        // Get format breakdown
        const formatBreakdown = await prisma.generatedImage.groupBy({
          by: ['format'],
          where: { clerkId: userId },
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

    // Get user images using the imageStorage function
    console.log('📡 Fetching user images with options:', { includeData, limit, offset });
    const images = await getUserImages(userId, {
      includeData,
      limit,
      offset
    });

    console.log('✅ Found', images.length, 'images for user:', userId);
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
      images: images 
    });

  } catch (error) {
    console.error('Error fetching image data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
