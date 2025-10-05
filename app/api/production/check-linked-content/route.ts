// app/api/production/check-linked-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { imageIds = [], videoIds = [] } = body;

    if (imageIds.length === 0 && videoIds.length === 0) {
      return NextResponse.json({ linkedImages: {}, linkedVideos: {} });
    }

    // Find which images are linked to tasks
    const linkedImages = await prisma.productionEntryImage.findMany({
      where: {
        imageId: { in: imageIds },
      },
      include: {
        productionEntry: {
          select: {
            id: true,
            influencer: true,
            status: true,
          },
        },
      },
    });

    // Find which videos are linked to tasks
    const linkedVideos = await prisma.productionEntryVideo.findMany({
      where: {
        videoId: { in: videoIds },
      },
      include: {
        productionEntry: {
          select: {
            id: true,
            influencer: true,
            status: true,
          },
        },
      },
    });

    // Create a map of contentId -> task info
    const imageLinksMap: Record<string, any[]> = {};
    linkedImages.forEach((link) => {
      if (!imageLinksMap[link.imageId]) {
        imageLinksMap[link.imageId] = [];
      }
      imageLinksMap[link.imageId].push({
        taskId: link.productionEntry.id,
        influencer: link.productionEntry.influencer,
        status: link.productionEntry.status,
      });
    });

    const videoLinksMap: Record<string, any[]> = {};
    linkedVideos.forEach((link) => {
      if (!videoLinksMap[link.videoId]) {
        videoLinksMap[link.videoId] = [];
      }
      videoLinksMap[link.videoId].push({
        taskId: link.productionEntry.id,
        influencer: link.productionEntry.influencer,
        status: link.productionEntry.status,
      });
    });

    return NextResponse.json({
      linkedImages: imageLinksMap,
      linkedVideos: videoLinksMap,
    });
  } catch (error) {
    console.error('Error checking linked content:', error);
    return NextResponse.json(
      { error: 'Failed to check linked content' },
      { status: 500 }
    );
  }
}
