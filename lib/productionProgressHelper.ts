// Helper function to update production progress when content is generated
export async function updateProductionProgress(userId: string, contentType: 'image' | 'video', count: number = 1) {
  try {
    console.log(`📊 Updating production progress: ${contentType} count +${count} for user ${userId}`);
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/manager/update-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We need to pass the auth info somehow - for server-side calls we'll handle this differently
      },
      body: JSON.stringify({
        contentType,
        count,
        userId // Pass userId directly for server-side calls
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Production progress updated successfully:', result.message);
      return result;
    } else {
      const error = await response.json();
      console.log('❌ Failed to update production progress:', error.error || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.error('❌ Error calling production progress update:', error);
    return null;
  }
}

// Server-side version that works with Prisma directly
import { PrismaClient } from '@/lib/generated/prisma';

export async function updateProductionProgressDirect(userId: string, contentType: 'image' | 'video', count: number = 1) {
  const prisma = new PrismaClient();
  
  try {
    console.log(`📊 [PRODUCTION PROGRESS] Starting update: ${contentType} count +${count} for user ${userId}`);
    
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

    console.log(`📊 [PRODUCTION PROGRESS] User found:`, currentUser);

    if (!currentUser) {
      console.log(`⚠️ [PRODUCTION PROGRESS] User ${userId} not found in database, skipping progress update`);
      return null;
    }

    if (!['MANAGER', 'ADMIN'].includes(currentUser.role)) {
      console.log(`⚠️ [PRODUCTION PROGRESS] User ${userId} is role "${currentUser.role}", not a manager or admin, skipping progress update`);
      return null;
    }

    // Build possible assignee names
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

    console.log(`📊 [PRODUCTION PROGRESS] Looking for tasks assigned to:`, possibleNames);

    // Find active production entries assigned to this manager
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

    console.log(`📊 [PRODUCTION PROGRESS] Found ${activeTasks.length} active task(s):`, activeTasks.map(t => ({ 
      id: t.id, 
      influencer: t.influencer, 
      assignee: t.assignee, 
      status: t.status 
    })));

    if (activeTasks.length === 0) {
      console.log('⚠️ [PRODUCTION PROGRESS] No active tasks found for manager, skipping production progress update');
      return null;
    }

    // Update the most urgent task
    const taskToUpdate = activeTasks[0];
    console.log(`📊 [PRODUCTION PROGRESS] Updating task:`, { 
      id: taskToUpdate.id, 
      influencer: taskToUpdate.influencer, 
      currentImages: taskToUpdate.imagesGenerated, 
      targetImages: taskToUpdate.imagesTarget,
      currentVideos: taskToUpdate.videosGenerated,
      targetVideos: taskToUpdate.videosTarget 
    });
    
    const updateData: any = {};
    let newStatus = taskToUpdate.status;

    if (contentType === 'image') {
      const newImageCount = taskToUpdate.imagesGenerated + count;
      updateData.imagesGenerated = newImageCount;
      console.log(`📊 [PRODUCTION PROGRESS] Image count: ${taskToUpdate.imagesGenerated} + ${count} = ${newImageCount}`);
      
      if (taskToUpdate.status === 'PENDING') {
        newStatus = 'IN_PROGRESS';
      }
      
      if (newImageCount >= taskToUpdate.imagesTarget && 
          taskToUpdate.videosGenerated >= taskToUpdate.videosTarget) {
        newStatus = 'COMPLETED';
      }
    } else if (contentType === 'video') {
      const newVideoCount = taskToUpdate.videosGenerated + count;
      updateData.videosGenerated = newVideoCount;
      console.log(`📊 [PRODUCTION PROGRESS] Video count: ${taskToUpdate.videosGenerated} + ${count} = ${newVideoCount}`);
      
      if (taskToUpdate.status === 'PENDING') {
        newStatus = 'IN_PROGRESS';
      }
      
      if (taskToUpdate.imagesGenerated >= taskToUpdate.imagesTarget && 
          newVideoCount >= taskToUpdate.videosTarget) {
        newStatus = 'COMPLETED';
      }
    }

    // Update status and notes if changed
    if (newStatus !== taskToUpdate.status) {
      updateData.status = newStatus;
      
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
      const timestamp = new Date().toLocaleString();
      const newNotes = existingNotes ? 
        `${existingNotes}\n\n[${timestamp}] ${progressNotes.join(' ')}` : 
        `[${timestamp}] ${progressNotes.join(' ')}`;
      updateData.notes = newNotes;
    }

    console.log(`📊 [PRODUCTION PROGRESS] Update data:`, updateData);
    console.log(`📊 [PRODUCTION PROGRESS] Status change: ${taskToUpdate.status} -> ${newStatus}`);

    // Update the production entry
    const updatedTask = await prisma.productionEntry.update({
      where: { id: taskToUpdate.id },
      data: updateData
    });

    console.log('✅ [PRODUCTION PROGRESS] Successfully updated:', {
      task: updatedTask.influencer,
      status: updatedTask.status,
      images: `${updatedTask.imagesGenerated}/${updatedTask.imagesTarget}`,
      videos: `${updatedTask.videosGenerated}/${updatedTask.videosTarget}`
    });

    return updatedTask;

  } catch (error) {
    console.error('❌ Error updating production progress directly:', error);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}