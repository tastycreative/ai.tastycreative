import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('Manager tasks API called');
    const { userId } = await auth();
    console.log('Auth userId:', userId);
    
    if (!userId) {
      console.log('No userId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user's information to find their name
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { 
        firstName: true, 
        lastName: true, 
        email: true, 
        role: true 
      }
    });

    console.log('Current user:', currentUser);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is a manager or admin
    if (!['MANAGER', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Access denied - Manager role required' }, { status: 403 });
    }

    // Build possible assignee names (we need to match against the assignee string)
    const possibleNames = [];
    if (currentUser.firstName && currentUser.lastName) {
      possibleNames.push(`${currentUser.firstName} ${currentUser.lastName}`);
    }
    if (currentUser.firstName) {
      possibleNames.push(currentUser.firstName);
    }
    if (currentUser.email) {
      possibleNames.push(currentUser.email);
    }

    console.log('Looking for tasks assigned to:', possibleNames);

    // Fetch production entries assigned to this manager
    const assignedTasks = await prisma.productionEntry.findMany({
      where: {
        assignee: {
          in: possibleNames
        }
      },
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    console.log('Found assigned tasks:', assignedTasks.length);

    // Also get stats about the tasks
    const taskStats = {
      total: assignedTasks.length,
      pending: assignedTasks.filter(task => task.status === 'PENDING').length,
      inProgress: assignedTasks.filter(task => task.status === 'IN_PROGRESS').length,
      completed: assignedTasks.filter(task => task.status === 'COMPLETED').length,
      failed: assignedTasks.filter(task => task.status === 'FAILED').length,
      overdue: assignedTasks.filter(task => 
        new Date(task.deadline) < new Date() && 
        !['COMPLETED'].includes(task.status)
      ).length
    };

    return NextResponse.json({
      tasks: assignedTasks,
      stats: taskStats,
      manager: {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        email: currentUser.email
      }
    });
  } catch (error) {
    console.error('Error fetching manager tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manager tasks' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}