import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`🔍 [DEBUG] Checking production progress setup for user: ${userId}`);

    // Get user info
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { 
        firstName: true, 
        lastName: true, 
        email: true, 
        role: true 
      }
    });

    // Build possible assignee names
    const possibleNames = [];
    if (currentUser?.firstName && currentUser?.lastName) {
      possibleNames.push(`${currentUser.firstName} ${currentUser.lastName}`);
    }
    if (currentUser?.firstName) {
      possibleNames.push(currentUser.firstName);
    }
    if (currentUser?.email) {
      possibleNames.push(currentUser.email);
    }

    // Find active tasks
    const activeTasks = await prisma.productionEntry.findMany({
      where: {
        assignee: {
          in: possibleNames
        },
        status: {
          not: 'COMPLETED'
        }
      },
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // Find ALL tasks (to see if there are any assigned with different names)
    const allTasks = await prisma.productionEntry.findMany({
      select: {
        id: true,
        assignee: true,
        influencer: true,
        status: true,
        imagesGenerated: true,
        imagesTarget: true,
        videosGenerated: true,
        videosTarget: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      userId,
      user: currentUser,
      isManagerOrAdmin: currentUser ? ['MANAGER', 'ADMIN'].includes(currentUser.role) : false,
      possibleNames,
      activeTasksCount: activeTasks.length,
      activeTasks: activeTasks.map(t => ({
        id: t.id,
        assignee: t.assignee,
        influencer: t.influencer,
        status: t.status,
        progress: `${t.imagesGenerated}/${t.imagesTarget} images, ${t.videosGenerated}/${t.videosTarget} videos`
      })),
      allTasksCount: allTasks.length,
      allTasks: allTasks.map(t => ({
        id: t.id,
        assignee: t.assignee,
        influencer: t.influencer,
        status: t.status,
        progress: `${t.imagesGenerated}/${t.imagesTarget} images, ${t.videosGenerated}/${t.videosTarget} videos`
      }))
    });

  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Debug failed', details: error?.message || 'Unknown error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}