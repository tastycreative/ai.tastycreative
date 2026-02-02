// app/api/production/my-tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database to check role and get display name
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

    // Build assignee name (same logic as in production tracker)
    const assigneeName = dbUser.firstName && dbUser.lastName
      ? `${dbUser.firstName} ${dbUser.lastName}`
      : dbUser.firstName || dbUser.lastName || dbUser.email || 'Unknown';

    // Fetch production entries assigned to this user
    // Regular users see their assigned tasks, admins see all
    const whereClause = dbUser.role !== 'ADMIN'
      ? { assignee: assigneeName }
      : {};

    const productionEntries = await prisma.productionEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        deadline: true,
        assignee: true,
        influencer: true,
        instagramSource: true,
        loraModel: true,
        status: true,
        imagesTarget: true,
        imagesGenerated: true,
        videosTarget: true,
        videosGenerated: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        linkedImages: {
          select: {
            imageId: true,
          },
        },
        linkedVideos: {
          select: {
            videoId: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { deadline: 'asc' },
      ],
    });

    return NextResponse.json(productionEntries);
  } catch (error) {
    console.error('Error fetching production tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch production tasks' },
      { status: 500 }
    );
  }
}
