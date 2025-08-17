// app/api/training/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`🔍 Looking up training job: ${jobId}`);

    // Get training job by RunPod ID
    const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(jobId);
    
    if (!trainingJob) {
      console.log(`❌ Training job not found: ${jobId}`);
      return NextResponse.json({ error: 'Training job not found' }, { status: 404 });
    }

    console.log(`✅ Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

    // Return the job info
    return NextResponse.json({
      success: true,
      job: {
        id: trainingJob.id,
        clerkId: trainingJob.clerkId,
        name: trainingJob.name,
        description: trainingJob.description,
        status: trainingJob.status,
        runpodJobId: trainingJob.runpodJobId,
        createdAt: trainingJob.createdAt,
        updatedAt: trainingJob.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error fetching training job:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch training job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
