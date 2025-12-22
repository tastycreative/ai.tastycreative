// app/api/jobs/[jobId]/cancel/route.ts - Cancel generation job API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();
    const { jobId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    console.log(`🛑 Canceling job ${jobId} for user ${userId}`);

    // Find the job in database
    const job = await prisma.generationJob.findUnique({
      where: {
        id: jobId,
        clerkId: userId, // Ensure user owns this job
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found or access denied' },
        { status: 404 }
      );
    }

    // Don't cancel if already completed or failed
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot cancel job with status: ${job.status}`,
          currentStatus: job.status
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Job details:`, {
      id: job.id,
      status: job.status,
      type: job.type,
      comfyUIPromptId: job.comfyUIPromptId
    });

    // Try to get RunPod job ID from params if available
    let runpodJobId = job.comfyUIPromptId; // Often the same as runpod job ID
    if (job.params && typeof job.params === 'object') {
      const params = job.params as any;
      runpodJobId = params.runpodJobId || params.jobId || runpodJobId;
    }

    console.log(`🔍 RunPod job ID for cancellation: ${runpodJobId}`);

    // Cancel the RunPod serverless job if we have an ID
    let runpodCancelResult = null;
    if (runpodJobId) {
      try {
        console.log(`🛑 Attempting to cancel RunPod job: ${runpodJobId}`);
        
        const runpodApiKey = process.env.RUNPOD_API_KEY;
        if (!runpodApiKey) {
          console.error('❌ RUNPOD_API_KEY not found in environment variables');
          runpodCancelResult = { error: 'RunPod API key not configured' };
        } else {
          // Determine the correct endpoint based on generation type
          let endpointId = '';
          switch (job.type) {
            case 'TEXT_TO_IMAGE':
              endpointId = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID || '';
              break;
            case 'IMAGE_TO_IMAGE': // Style transfer
              endpointId = process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID || '';
              break;
            case 'SKIN_ENHANCEMENT':
              endpointId = process.env.RUNPOD_SKIN_ENHANCER_ENDPOINT_ID || '';
              break;
            case 'FACE_SWAP':
              endpointId = process.env.RUNPOD_FACE_SWAP_ENDPOINT_ID || '';
              break;
            case 'IMAGE_TO_VIDEO':
              endpointId = process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID || '';
              break;
            default:
              console.warn(`⚠️ Unknown generation type: ${job.type}`);
              break;
          }

          console.log(`🎯 Using endpoint ID for ${job.type}: ${endpointId ? endpointId : 'NOT_FOUND'}`);

          if (endpointId) {
            // Try both cancel methods for serverless endpoints
            
            // Method 1: Standard cancel endpoint
            const runpodCancelUrl = `https://api.runpod.ai/v2/${endpointId}/cancel/${runpodJobId}`;
            console.log(`🌐 RunPod cancel URL (Method 1): ${runpodCancelUrl}`);
            
            const runpodResponse = await fetch(runpodCancelUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${runpodApiKey}`,
                'Content-Type': 'application/json',
              },
            });

            console.log(`📡 RunPod cancel response status: ${runpodResponse.status}`);

            if (runpodResponse.ok) {
              const runpodData = await runpodResponse.json();
              console.log('✅ RunPod job canceled successfully (Method 1):', runpodData);
              runpodCancelResult = runpodData;
            } else {
              const errorText = await runpodResponse.text();
              console.error(`❌ Method 1 failed: ${runpodResponse.status} - ${errorText}`);
              
              // Method 2: Try status check to see if job is still running, then force terminate
              try {
                const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${runpodJobId}`;
                console.log(`🔍 Checking job status: ${statusUrl}`);
                
                const statusResponse = await fetch(statusUrl, {
                  headers: {
                    'Authorization': `Bearer ${runpodApiKey}`,
                  },
                });

                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  console.log('📊 RunPod job status:', statusData);
                  
                  // If job is still running, mark our database as cancelled anyway
                  // The webhook should handle the case where RunPod completes after cancellation
                  runpodCancelResult = { 
                    error: `Cancel request failed but job status checked`,
                    status: statusData,
                    method1Error: errorText 
                  };
                } else {
                  runpodCancelResult = { 
                    error: `Both cancel and status check failed: ${runpodResponse.status}`,
                    details: errorText 
                  };
                }
              } catch (statusError) {
                console.error('❌ Status check also failed:', statusError);
                runpodCancelResult = { 
                  error: 'RunPod cancel and status check both failed',
                  details: errorText,
                  statusError: statusError instanceof Error ? statusError.message : 'Unknown error'
                };
              }
            }
          } else {
            console.error(`❌ No endpoint ID found for generation type: ${job.type}`);
            console.error(`Available environment variables:`, {
              'RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID': !!process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID,
              'RUNPOD_STYLE_TRANSFER_ENDPOINT_ID': !!process.env.RUNPOD_STYLE_TRANSFER_ENDPOINT_ID,
              'RUNPOD_SKIN_ENHANCER_ENDPOINT_ID': !!process.env.RUNPOD_SKIN_ENHANCER_ENDPOINT_ID,
              'RUNPOD_FACE_SWAP_ENDPOINT_ID': !!process.env.RUNPOD_FACE_SWAP_ENDPOINT_ID,
              'RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID': !!process.env.RUNPOD_IMAGE_TO_VIDEO_ENDPOINT_ID,
            });
            runpodCancelResult = { 
              error: `No endpoint ID configured for ${job.type}` 
            };
          }
        }
      } catch (runpodError) {
        console.error('❌ Error during RunPod cancellation process:', runpodError);
        runpodCancelResult = { 
          error: 'RunPod cancel request failed',
          details: runpodError instanceof Error ? runpodError.message : 'Unknown error'
        };
      }
    } else {
      console.warn('⚠️ No RunPod job ID found for cancellation');
      runpodCancelResult = { error: 'No RunPod job ID available for cancellation' };
    }

    // Update job status in database to 'FAILED' with cancellation info
    const updatedJob = await prisma.generationJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: 'FAILED',
        error: 'Job canceled by user',
        updatedAt: new Date(),
        // Store cancellation info in params
        params: {
          ...(job.params as any || {}),
          canceledAt: new Date().toISOString(),
          canceledBy: userId,
          runpodCancelResult: runpodCancelResult,
        },
      },
    });

    console.log(`✅ Job ${jobId} marked as canceled in database`);

    return NextResponse.json({
      success: true,
      message: 'Job canceled successfully',
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        error: updatedJob.error,
        canceledAt: new Date().toISOString(),
      },
      runpodResult: runpodCancelResult,
    });

  } catch (error) {
    console.error('❌ Error canceling job:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}