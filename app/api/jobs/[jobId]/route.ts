// app/api/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Import the jobs from the generation route
import { jobs } from '../../generate/text-to-image/route';

function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'default-user';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Await the params to fix Next.js error
    const { jobId } = await params;
    console.log('Checking job status for:', jobId);

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    const job = jobs.get(jobId);
    console.log('Job status:', job?.status);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const userId = getUserId(request);
    
    // Ensure user can only access their own jobs
    if (job.userId && job.userId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}