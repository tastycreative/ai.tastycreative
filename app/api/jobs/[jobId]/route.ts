import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJob } from '@/lib/jobsStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    console.log('🔍 Getting job status for:', jobId);

    // Get job from database
    const job = await getJob(jobId);
    
    if (!job) {
      console.log('❌ Job not found:', jobId);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify job belongs to user
    if (job.clerkId !== userId) {
      console.log('🚫 Job access denied - user mismatch:', { jobUserId: job.clerkId, requestUserId: userId });
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    console.log('✅ Job found:', { id: job.id, status: job.status, progress: job.progress });

    // Return job status
    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress || 0,
      error: job.error,
      resultUrls: job.resultUrls || [],
      createdAt: job.createdAt,
      comfyUIPromptId: job.comfyUIPromptId,
      // Enhanced progress fields
      stage: job.stage,
      message: job.message,
      elapsedTime: job.elapsedTime,
      estimatedTimeRemaining: job.estimatedTimeRemaining
    });

  } catch (error) {
    console.error('❌ Job status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
