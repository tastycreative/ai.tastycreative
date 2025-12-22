import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, postId, fileName, instagramUrl, publishedAt } = body;

    // Get all admins and managers
    const adminsAndManagers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'MANAGER']
        }
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        role: true,
      }
    });

    // Get the user who published the post
    const publisher = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      }
    });

    const publisherName = publisher?.firstName 
      ? `${publisher.firstName} ${publisher.lastName || ''}`.trim()
      : publisher?.email || 'A content creator';

    // Create notifications for each admin/manager
    const notificationPromises = adminsAndManagers.map(async (admin) => {
      // Don't notify if they're the one who published it
      if (admin.clerkId === userId) return null;

      const hasUrl = instagramUrl && instagramUrl.length > 0;
      
      return prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: hasUrl ? '🎉 Post Published with Link!' : '📸 Post Published',
          message: hasUrl
            ? `${publisherName} published "${fileName}" and added the Instagram link`
            : `${publisherName} published "${fileName}" (no Instagram link yet)`,
          link: `/dashboard/workspace/social-media`,
          metadata: {
            postId,
            fileName,
            instagramUrl: hasUrl ? instagramUrl : null,
            publishedAt,
            publisherId: userId,
            publisherName,
          },
          read: false,
        }
      });
    });

    await Promise.all(notificationPromises);

    console.log(`📬 Notified ${adminsAndManagers.length} admins/managers about post publication`);

    return NextResponse.json({
      success: true,
      notifiedCount: adminsAndManagers.filter(a => a.clerkId !== userId).length,
    });

  } catch (error) {
    console.error('❌ Error sending admin notifications:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to send notifications',
      },
      { status: 500 }
    );
  }
}
