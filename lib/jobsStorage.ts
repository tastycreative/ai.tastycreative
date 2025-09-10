// lib/jobsStorage.ts - Updated with Clerk integration
import { prisma } from './database';
import { JobStatus, GenerationType } from './generated/prisma';

export interface GenerationJob {
  id: string;
  clerkId: string;
  userId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  resultUrls?: string[];
  error?: string;
  type?: GenerationType;
  createdAt: Date | string;
  params?: any;
  comfyUIPromptId?: string;
  lastChecked?: string;
}

export const sharedJobs = new Map<string, GenerationJob>();

// Helper functions for job management with Prisma + Clerk
export async function addJob(job: GenerationJob): Promise<void> {
  console.log('📝 Adding job to database:', job.id);
  console.log('👤 Clerk user:', job.clerkId);
  
  try {
    // Ensure user exists
    await prisma.user.upsert({
      where: { clerkId: job.clerkId },
      update: {},
      create: { clerkId: job.clerkId }
    });
    
    await prisma.generationJob.create({
      data: {
        id: job.id,
        clerkId: job.clerkId,
        status: (job.status.toUpperCase() as JobStatus),
        progress: job.progress || 0,
        resultUrls: job.resultUrls || [],
        error: job.error,
        type: job.type || 'TEXT_TO_IMAGE', // Default to TEXT_TO_IMAGE if not specified
        params: job.params || {},
        comfyUIPromptId: job.comfyUIPromptId,
        lastChecked: job.lastChecked ? new Date(job.lastChecked) : null
      }
    });
    
    console.log('✅ Job added to database successfully');
  } catch (error) {
    console.error('💥 Error adding job to database:', error);
    throw error;
  }
}

export async function getJob(jobId: string): Promise<GenerationJob | undefined> {
  console.log('🔍 Getting job from database:', jobId);
  
  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });
    
    if (!job) {
      console.log('❌ Job not found in database');
      return undefined;
    }
    
    console.log('✅ Job found in database:', job.status);
    console.log('👤 Job belongs to Clerk user:', job.clerkId);
    
    return {
      id: job.id,
      clerkId: job.clerkId,
      userId: job.clerkId,
      status: job.status.toLowerCase() as any,
      progress: job.progress || undefined,
      resultUrls: job.resultUrls,
      error: job.error || undefined,
      type: job.type,
      createdAt: job.createdAt,
      params: job.params,
      comfyUIPromptId: job.comfyUIPromptId || undefined,
      lastChecked: job.lastChecked?.toISOString()
    };
  } catch (error) {
    console.error('💥 Error getting job from database:', error);
    return undefined;
  }
}

export async function updateJob(jobId: string, updates: Partial<GenerationJob>): Promise<GenerationJob | null> {
  console.log('🔄 Updating job in database:', jobId);
  console.log('📝 Updates:', updates);
  
  try {
    // First check if job exists
    const existingJob = await prisma.generationJob.findUnique({
      where: { id: jobId }
    });
    
    if (!existingJob) {
      console.error('❌ Job not found for update:', jobId);
      throw new Error(`Job ${jobId} not found`);
    }
    
    const updateData: any = {};
    
    if (updates.status !== undefined) {
      updateData.status = updates.status.toUpperCase() as JobStatus;
    }
    if (updates.progress !== undefined) {
      updateData.progress = updates.progress;
    }
    if (updates.resultUrls !== undefined) {
      updateData.resultUrls = updates.resultUrls;
    }
    if (updates.error !== undefined) {
      updateData.error = updates.error;
    }
    if (updates.type !== undefined) {
      updateData.type = updates.type;
    }
    if (updates.params !== undefined) {
      updateData.params = updates.params;
    }
    if (updates.comfyUIPromptId !== undefined) {
      updateData.comfyUIPromptId = updates.comfyUIPromptId;
    }
    if (updates.lastChecked !== undefined) {
      updateData.lastChecked = new Date(updates.lastChecked);
    }
    
    // Add current timestamp to track when update happened
    updateData.updatedAt = new Date();
    
    const updated = await prisma.generationJob.update({
      where: { id: jobId },
      data: updateData
    });
    
    console.log('✅ Job updated successfully in database');
    
    return {
      id: updated.id,
      clerkId: updated.clerkId,
      userId: updated.clerkId,
      status: updated.status.toLowerCase() as any,
      progress: updated.progress || undefined,
      resultUrls: updated.resultUrls,
      error: updated.error || undefined,
      type: updated.type,
      createdAt: updated.createdAt,
      params: updated.params,
      comfyUIPromptId: updated.comfyUIPromptId || undefined,
      lastChecked: updated.lastChecked?.toISOString()
    };
  } catch (error) {
    console.error('💥 Error updating job in database:', jobId, error);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // Truncate stack trace
      });
    }
    
    // Re-throw the error so webhook can handle retries
    throw error;
  }
}

export async function deleteJob(jobId: string): Promise<boolean> {
  console.log('🗑️ Deleting job from database:', jobId);
  
  try {
    await prisma.generationJob.delete({
      where: { id: jobId }
    });
    
    console.log('✅ Job deleted from database');
    return true;
  } catch (error) {
    console.error('💥 Error deleting job from database:', error);
    return false;
  }
}

export async function getAllJobs(): Promise<GenerationJob[]> {
  console.log('📋 Getting all jobs from database');
  
  try {
    const jobs = await prisma.generationJob.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📊 Total jobs found:', jobs.length);
    
    return jobs.map(job => ({
      id: job.id,
      clerkId: job.clerkId,
      userId: job.clerkId,
      status: job.status.toLowerCase() as any,
      progress: job.progress || undefined,
      resultUrls: job.resultUrls,
      error: job.error || undefined,
      type: job.type,
      createdAt: job.createdAt,
      params: job.params,
      comfyUIPromptId: job.comfyUIPromptId || undefined,
      lastChecked: job.lastChecked?.toISOString()
    }));
  } catch (error) {
    console.error('💥 Error getting all jobs from database:', error);
    return [];
  }
}

export async function getJobsByUser(clerkId: string): Promise<GenerationJob[]> {
  console.log('👤 Getting jobs for Clerk user from database:', clerkId);
  
  try {
    const jobs = await prisma.generationJob.findMany({
      where: { clerkId },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📊 User jobs found:', jobs.length);
    
    return jobs.map(job => ({
      id: job.id,
      clerkId: job.clerkId,
      userId: job.clerkId,
      status: job.status.toLowerCase() as any,
      progress: job.progress || undefined,
      resultUrls: job.resultUrls,
      error: job.error || undefined,
      type: job.type,
      createdAt: job.createdAt,
      params: job.params,
      comfyUIPromptId: job.comfyUIPromptId || undefined,
      lastChecked: job.lastChecked?.toISOString()
    }));
  } catch (error) {
    console.error('💥 Error getting user jobs from database:', error);
    return [];
  }
}

export async function getJobIds(): Promise<string[]> {
  try {
    const jobs = await prisma.generationJob.findMany({
      select: { id: true }
    });
    
    const ids = jobs.map(job => job.id);
    console.log('🗂️ All job IDs in database:', ids);
    return ids;
  } catch (error) {
    console.error('💥 Error getting job IDs from database:', error);
    return [];
  }
}

// Debug function
export async function debugJobsStorage(): Promise<any> {
  try {
    const totalJobs = await prisma.generationJob.count();
    const jobsByStatus = await prisma.generationJob.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    const recentJobs = await prisma.generationJob.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clerkId: true,
        status: true,
        progress: true,
        createdAt: true,
        resultUrls: true
      }
    });
    
    const debug = {
      totalJobs,
      jobsByStatus: jobsByStatus.reduce((acc, item) => {
        acc[item.status.toLowerCase()] = item._count.status;
        return acc;
      }, {} as Record<string, number>),
      recentJobs: recentJobs.map(job => ({
        id: job.id,
        clerkId: job.clerkId,
        status: job.status.toLowerCase(),
        progress: job.progress,
        createdAt: job.createdAt,
        hasResults: job.resultUrls.length > 0,
        resultCount: job.resultUrls.length
      })),
      timestamp: new Date().toISOString()
    };
    
    console.log('🔍 Debug jobs storage:', debug);
    return debug;
  } catch (error) {
    console.error('💥 Error debugging jobs storage:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Cleanup function to remove old completed jobs
export async function cleanupOldJobs(maxAgeHours: number = 24): Promise<number> {
  console.log('🧹 Cleaning up old jobs...');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
    
    const result = await prisma.generationJob.deleteMany({
      where: {
        AND: [
          { createdAt: { lt: cutoffDate } },
          { 
            OR: [
              { status: 'COMPLETED' },
              { status: 'FAILED' }
            ]
          }
        ]
      }
    });
    
    console.log('🧹 Cleaned up', result.count, 'old jobs');
    return result.count;
  } catch (error) {
    console.error('💥 Error cleaning up old jobs:', error);
    return 0;
  }
}