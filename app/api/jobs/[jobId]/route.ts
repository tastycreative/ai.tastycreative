// app/api/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Import the jobs Map from the generation endpoint
// In production, you'd use a shared database or Redis
const jobs: Map<string, any> = new Map();

// You can also import from the generation file if needed
// import { jobs } from '../../generate/text-to-image/route';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    console.log('Checking job status for:', jobId);

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // In a real app, you'd get this from a database or Redis
    // For now, we need to access the jobs from the generation endpoint
    
    // Try to get job from the generation endpoint's jobs Map
    // This is a temporary solution - in production use shared storage
    const jobsModule = await import('../../generate/text-to-image/route');
    const job = jobsModule.jobs.get(jobId);

    if (!job) {
      console.log('Job not found:', jobId);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    console.log('Job status:', job.status);

    // Return job status
    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      resultUrls: job.resultUrls,
      error: job.error,
      createdAt: job.createdAt,
    });

  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Optional: DELETE endpoint to cancel jobs
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    console.log('Cancelling job:', jobId);
    
    const jobsModule = await import('../../generate/text-to-image/route');
    const job = jobsModule.jobs.get(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Cancel the job if it's still processing
    if (job.status === 'pending' || job.status === 'processing') {
      // You can implement ComfyUI job cancellation here
      try {
        const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';
        await fetch(`${COMFYUI_URL}/interrupt`, {
          method: 'POST',
        });
        console.log('Sent interrupt to ComfyUI');
      } catch (error) {
        console.error('Error cancelling ComfyUI job:', error);
      }

      job.status = 'failed';
      job.error = 'Cancelled by user';
      jobsModule.jobs.set(jobId, job);
    }

    return NextResponse.json({ 
      message: 'Job cancelled successfully',
      status: job.status 
    });

  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}