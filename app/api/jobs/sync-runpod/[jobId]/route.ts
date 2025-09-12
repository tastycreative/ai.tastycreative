import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateJob, getJob } from '@/lib/jobsStorage';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;
const RUNPOD_STYLE_TRANSFER_ENDPOINT_ID = process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID;

export async function POST(
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
    
    console.log('🔄 Syncing RunPod job status for:', jobId);

    // Get job from database
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify user owns this job
    if (job.clerkId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get RunPod job ID from params
    const runpodJobId = job.params?.runpodJobId;
    if (!runpodJobId) {
      return NextResponse.json({ error: 'No RunPod job ID found' }, { status: 400 });
    }

    console.log('📡 Checking RunPod status for:', runpodJobId);

    // Determine which endpoint to use based on job action/type
    let endpointId = RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID; // Default
    
    if (job.params?.action === 'generate_style_transfer' || 
        job.params?.generation_type === 'style_transfer') {
      endpointId = RUNPOD_STYLE_TRANSFER_ENDPOINT_ID;
      console.log('🎨 Using style transfer endpoint for job sync');
    } else {
      console.log('🖼️ Using text-to-image endpoint for job sync');
    }

    if (!endpointId) {
      console.error('❌ No RunPod endpoint ID configured for this job type');
      return NextResponse.json(
        { error: 'RunPod endpoint not configured' },
        { status: 500 }
      );
    }

    // Check RunPod job status
    const runpodResponse = await fetch(
      `https://api.runpod.ai/v2/${endpointId}/status/${runpodJobId}`,
      {
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (runpodResponse.status === 404) {
      // Job might have expired, check if it was completed based on time
      const jobAge = Date.now() - new Date(job.createdAt).getTime();
      const maxJobTime = 15 * 60 * 1000; // 15 minutes

      if (jobAge > maxJobTime && job.status === 'processing') {
        // Assume job completed if it's been processing for more than 15 minutes
        console.log('⏰ Job expired from RunPod, assuming completed');
        
        await updateJob(jobId, {
          status: 'completed',
          progress: 100,
          resultUrls: ['Job completed but image data not retrieved (expired from RunPod cache)']
        });

        return NextResponse.json({
          success: true,
          status: 'completed',
          message: 'Job marked as completed (expired from RunPod cache)'
        });
      }

      return NextResponse.json({ error: 'RunPod job not found' }, { status: 404 });
    }

    if (!runpodResponse.ok) {
      console.error('❌ RunPod API error:', runpodResponse.status);
      return NextResponse.json({ error: 'Failed to check RunPod status' }, { status: 500 });
    }

    const runpodResult = await runpodResponse.json();
    console.log('📋 RunPod result:', runpodResult);

    // Update job based on RunPod status
    if (runpodResult.status === 'COMPLETED') {
      const updateData: any = {
        status: 'completed',
        progress: 100
      };

      // If there's output data, process it
      if (runpodResult.output) {
        if (runpodResult.output.images && Array.isArray(runpodResult.output.images)) {
          updateData.resultUrls = runpodResult.output.images;
        } else if (runpodResult.output.image_data) {
          updateData.resultUrls = [runpodResult.output.image_data];
        }
      }

      await updateJob(jobId, updateData);
      
      console.log('✅ Job synced and marked as completed:', jobId);
      
      return NextResponse.json({
        success: true,
        status: 'completed',
        message: 'Job synced successfully'
      });
    } else if (runpodResult.status === 'FAILED') {
      await updateJob(jobId, {
        status: 'failed',
        error: runpodResult.error || 'Job failed on RunPod'
      });

      return NextResponse.json({
        success: true,
        status: 'failed',
        message: 'Job marked as failed'
      });
    }

    // Job is still running
    return NextResponse.json({
      success: true,
      status: runpodResult.status,
      message: 'Job still processing'
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
