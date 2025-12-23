import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get scheduled posts (SCHEDULED, PENDING, or APPROVED status)
    const scheduledPosts = await prisma.instagramPost.findMany({
      where: {
        clerkId: userId,
        status: {
          in: ['SCHEDULED', 'PENDING', 'APPROVED'],
        },
        scheduledDate: {
          not: null,
          gte: new Date(), // Only future dates
        },
      },
      select: {
        id: true,
        fileName: true,
        caption: true,
        scheduledDate: true,
        postType: true,
        awsS3Url: true,
        driveFileUrl: true,
      },
      orderBy: {
        scheduledDate: 'asc',
      },
      take: 10,
    });

    return NextResponse.json(scheduledPosts);
  } catch (error) {
    console.error('Error loading scheduled events:', error);
    return NextResponse.json(
      { error: 'Failed to load scheduled events' },
      { status: 500 }
    );
  }
}
