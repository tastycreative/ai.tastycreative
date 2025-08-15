// app/api/debug/recent-jobs/route.ts - Debug recent generation jobs
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('🔍 === DEBUG RECENT JOBS ===');
    console.log('👤 User ID:', clerkId);

    // Get recent generation jobs
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: clerkId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`📊 Found ${recentJobs.length} recent jobs for user`);

    // Get image counts for each job
    const jobsWithImageCounts = await Promise.all(
      recentJobs.map(async (job) => {
        const imageCount = await prisma.generatedImage.count({
          where: { jobId: job.id }
        });
        return { ...job, imageCount };
      })
    );

    const processedJobs = jobsWithImageCounts.map(job => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      lastChecked: job.lastChecked,
      comfyUIPromptId: job.comfyUIPromptId,
      hasResultUrls: !!job.resultUrls && job.resultUrls.length > 0,
      resultUrlsCount: job.resultUrls?.length || 0,
      imageCount: job.imageCount,
      error: job.error
    }));

    // Also get recent images
    const recentImages = await prisma.generatedImage.findMany({
      where: {
        clerkId: clerkId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        filename: true,
        jobId: true,
        createdAt: true,
        subfolder: true,
        type: true,
        width: true,
        height: true
      }
    });

    console.log(`📸 Found ${recentImages.length} recent images for user`);

    return NextResponse.json({
      success: true,
      data: {
        jobs: processedJobs,
        images: recentImages,
        summary: {
          totalJobs: recentJobs.length,
          completedJobs: recentJobs.filter(j => j.status === 'COMPLETED').length,
          failedJobs: recentJobs.filter(j => j.status === 'FAILED').length,
          pendingJobs: recentJobs.filter(j => j.status === 'PENDING').length,
          processingJobs: recentJobs.filter(j => j.status === 'PROCESSING').length,
          totalImages: recentImages.length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Debug recent jobs failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
