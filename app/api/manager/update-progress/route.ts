import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    console.log('Production progress update API called');
    const { userId } = await auth();
    console.log('Auth userId:', userId);
    
    if (!userId) {
      console.log('No userId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current user's information to find their name for matching
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

    const body = await request.json();
    const { contentType, count } = body; // contentType: 'image' or 'video', count: number of items generated

    console.log('Progress update request:', { contentType, count });

    if (!contentType || !['image', 'video'].includes(contentType)) {
      return NextResponse.json({ error: 'Invalid content type. Must be "image" or "video"' }, { status: 400 });
    }

    if (!count || count <= 0) {
      return NextResponse.json({ error: 'Invalid count. Must be a positive number' }, { status: 400 });
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

    console.log('Looking for active tasks assigned to:', possibleNames);

    // Find active production entries assigned to this manager (not completed)
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

    console.log('Found active tasks:', activeTasks.length);

    if (activeTasks.length === 0) {
      return NextResponse.json({ 
        message: 'No active tasks found to update',
        updated: 0
      });
    }

    // Update the most urgent task (earliest deadline, most recent if same deadline)
    const taskToUpdate = activeTasks[0];
    console.log('Updating task:', taskToUpdate.id, 'for influencer:', taskToUpdate.influencer);

    const updateData: any = {};
    let newStatus = taskToUpdate.status;

    if (contentType === 'image') {
      const newImageCount = taskToUpdate.imagesGenerated + count;
      updateData.imagesGenerated = newImageCount;
      
      // Check if we should update status
      if (taskToUpdate.status === 'PENDING') {
        newStatus = 'IN_PROGRESS';
      }
      
      // Check if task is completed
      if (newImageCount >= taskToUpdate.imagesTarget && 
          taskToUpdate.videosGenerated >= taskToUpdate.videosTarget) {
        newStatus = 'COMPLETED';
      }
    } else if (contentType === 'video') {
      const newVideoCount = taskToUpdate.videosGenerated + count;
      updateData.videosGenerated = newVideoCount;
      
      // Check if we should update status
      if (taskToUpdate.status === 'PENDING') {
        newStatus = 'IN_PROGRESS';
      }
      
      // Check if task is completed
      if (taskToUpdate.imagesGenerated >= taskToUpdate.imagesTarget && 
          newVideoCount >= taskToUpdate.videosTarget) {
        newStatus = 'COMPLETED';
      }
    }

    // Update status if it changed
    if (newStatus !== taskToUpdate.status) {
      updateData.status = newStatus;
      
      // Generate automatic notes
      const progressNotes = [];
      if (contentType === 'image') {
        progressNotes.push(`${count} image(s) generated. Total: ${updateData.imagesGenerated}/${taskToUpdate.imagesTarget} images`);
      } else {
        progressNotes.push(`${count} video(s) generated. Total: ${updateData.videosGenerated}/${taskToUpdate.videosTarget} videos`);
      }
      
      if (newStatus === 'COMPLETED') {
        progressNotes.push('Task completed! All targets reached.');
      } else if (newStatus === 'IN_PROGRESS') {
        progressNotes.push('Task started.');
      }
      
      const existingNotes = taskToUpdate.notes || '';
      const newNotes = existingNotes ? `${existingNotes}\n\n${progressNotes.join(' ')}` : progressNotes.join(' ');
      updateData.notes = newNotes;
    }

    console.log('Update data:', updateData);

    // Update the production entry
    const updatedTask = await prisma.productionEntry.update({
      where: { id: taskToUpdate.id },
      data: updateData
    });

    console.log('Successfully updated production entry:', updatedTask.id);

    return NextResponse.json({
      success: true,
      updated: 1,
      task: {
        id: updatedTask.id,
        influencer: updatedTask.influencer,
        status: updatedTask.status,
        imagesGenerated: updatedTask.imagesGenerated,
        imagesTarget: updatedTask.imagesTarget,
        videosGenerated: updatedTask.videosGenerated,
        videosTarget: updatedTask.videosTarget
      },
      message: `Updated ${contentType} count for task: ${updatedTask.influencer}`
    });

  } catch (error) {
    console.error('Error updating production progress:', error);
    return NextResponse.json(
      { error: 'Failed to update production progress' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}