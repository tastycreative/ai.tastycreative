// app/api/production/link-content/route.ts
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
    const { productionEntryId, imageIds = [], videoIds = [] } = body;

    if (!productionEntryId) {
      return NextResponse.json(
        { error: 'Production entry ID is required' },
        { status: 400 }
      );
    }

    if (imageIds.length === 0 && videoIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one image or video ID is required' },
        { status: 400 }
      );
    }

    // Verify production entry exists and belongs to user's organization
    const productionEntry = await prisma.productionEntry.findUnique({
      where: { id: productionEntryId },
      include: {
        linkedImages: true,
        linkedVideos: true,
      },
    });

    if (!productionEntry) {
      return NextResponse.json(
        { error: 'Production entry not found' },
        { status: 404 }
      );
    }

    // Check if user has access (owner, admin, manager, or assigned content creator)
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const assigneeName = dbUser.firstName && dbUser.lastName
      ? `${dbUser.firstName} ${dbUser.lastName}`
      : dbUser.firstName || dbUser.lastName || dbUser.email || 'Unknown';

    const hasAccess = 
      productionEntry.clerkId === user.id ||
      dbUser.role === 'ADMIN' ||
      dbUser.role === 'MANAGER' ||
      productionEntry.assignee === assigneeName;

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get currently linked content IDs to avoid duplicates
    const currentlyLinkedImageIds = new Set(
      productionEntry.linkedImages.map(link => link.imageId)
    );
    const currentlyLinkedVideoIds = new Set(
      productionEntry.linkedVideos.map(link => link.videoId)
    );

    // Filter out already linked content
    const newImageIds = imageIds.filter((id: string) => !currentlyLinkedImageIds.has(id));
    const newVideoIds = videoIds.filter((id: string) => !currentlyLinkedVideoIds.has(id));

    // Create links and update counts in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Link images
      if (newImageIds.length > 0) {
        await tx.productionEntryImage.createMany({
          data: newImageIds.map((imageId: string) => ({
            productionEntryId,
            imageId,
          })),
          skipDuplicates: true,
        });
      }

      // Link videos
      if (newVideoIds.length > 0) {
        await tx.productionEntryVideo.createMany({
          data: newVideoIds.map((videoId: string) => ({
            productionEntryId,
            videoId,
          })),
          skipDuplicates: true,
        });
      }

      // Update production entry counts
      const updatedEntry = await tx.productionEntry.update({
        where: { id: productionEntryId },
        data: {
          imagesGenerated: {
            increment: newImageIds.length,
          },
          videosGenerated: {
            increment: newVideoIds.length,
          },
          // Auto-update status if targets are met
          status: productionEntry.imagesGenerated + newImageIds.length >= productionEntry.imagesTarget &&
                  productionEntry.videosGenerated + newVideoIds.length >= productionEntry.videosTarget
            ? 'COMPLETED'
            : productionEntry.imagesGenerated + newImageIds.length > 0 || productionEntry.videosGenerated + newVideoIds.length > 0
            ? 'IN_PROGRESS'
            : productionEntry.status,
        },
        include: {
          linkedImages: true,
          linkedVideos: true,
        },
      });

      return updatedEntry;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully linked ${newImageIds.length} image(s) and ${newVideoIds.length} video(s)`,
      productionEntry: result,
      alreadyLinked: {
        images: imageIds.length - newImageIds.length,
        videos: videoIds.length - newVideoIds.length,
      },
    });
  } catch (error) {
    console.error('Error linking content to production entry:', error);
    return NextResponse.json(
      { error: 'Failed to link content to production entry' },
      { status: 500 }
    );
  }
}

// Endpoint to unlink content from production entry
export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productionEntryId, imageIds = [], videoIds = [] } = body;

    if (!productionEntryId) {
      return NextResponse.json(
        { error: 'Production entry ID is required' },
        { status: 400 }
      );
    }

    // Verify access
    const productionEntry = await prisma.productionEntry.findUnique({
      where: { id: productionEntryId },
    });

    if (!productionEntry) {
      return NextResponse.json(
        { error: 'Production entry not found' },
        { status: 404 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const assigneeName = dbUser.firstName && dbUser.lastName
      ? `${dbUser.firstName} ${dbUser.lastName}`
      : dbUser.firstName || dbUser.lastName || dbUser.email || 'Unknown';

    const hasAccess = 
      productionEntry.clerkId === user.id ||
      dbUser.role === 'ADMIN' ||
      dbUser.role === 'MANAGER' ||
      productionEntry.assignee === assigneeName;

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Unlink and update counts in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Unlink images
      if (imageIds.length > 0) {
        await tx.productionEntryImage.deleteMany({
          where: {
            productionEntryId,
            imageId: { in: imageIds },
          },
        });
      }

      // Unlink videos
      if (videoIds.length > 0) {
        await tx.productionEntryVideo.deleteMany({
          where: {
            productionEntryId,
            videoId: { in: videoIds },
          },
        });
      }

      // Update production entry counts
      const updatedEntry = await tx.productionEntry.update({
        where: { id: productionEntryId },
        data: {
          imagesGenerated: {
            decrement: imageIds.length,
          },
          videosGenerated: {
            decrement: videoIds.length,
          },
        },
      });

      return updatedEntry;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully unlinked ${imageIds.length} image(s) and ${videoIds.length} video(s)`,
      productionEntry: result,
    });
  } catch (error) {
    console.error('Error unlinking content from production entry:', error);
    return NextResponse.json(
      { error: 'Failed to unlink content from production entry' },
      { status: 500 }
    );
  }
}
