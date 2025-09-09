import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Get job status from database
    const job = await prisma.generationJob.findFirst({
      where: {
        id: jobId,
        clerkId: userId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Map database status to frontend expected format
    let frontendStatus = job.status.toLowerCase();
    if (frontendStatus === 'processing') {
      frontendStatus = 'running';
    } else if (frontendStatus === 'completed') {
      frontendStatus = 'completed';
    } else if (frontendStatus === 'failed') {
      frontendStatus = 'failed';
    } else {
      frontendStatus = 'pending';
    }

    return NextResponse.json({
      id: job.id,
      status: frontendStatus,
      progress: job.progress || 0,
      resultUrls: job.resultUrls || [],
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });

  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
