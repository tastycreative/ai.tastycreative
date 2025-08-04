// app/api/generate/text-to-image/route.ts - FIXED with Clerk + NeonDB
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@clerk/nextjs/server';
import { incrementInfluencerUsage } from '@/lib/database';
import { 
  addJob, 
  getJob, 
  updateJob, 
  debugJobsStorage,
  type GenerationJob 
} from '@/lib/jobsStorage';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15833';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from Clerk
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      console.log('No authenticated user found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('=== GENERATION REQUEST (CLERK + NEONDB) ===');
    console.log('Generating image for Clerk user:', clerkId);
    console.log('ComfyUI URL:', COMFYUI_URL);
    
    const { workflow, params } = await request.json();
    
    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow data' },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    console.log('Created job ID:', jobId);
    
    // Create job with Clerk user ID
    const job: GenerationJob = {
      id: jobId,
      clerkId,
      userId: clerkId,
      status: "pending",
      createdAt: new Date(),
      params,
      lastChecked: new Date().toISOString(),
      progress: 0
    };

    console.log('Adding job to NeonDB...');
    console.log('Job details:', {
      id: job.id,
      clerkId: job.clerkId,
      status: job.status,
      createdAt: job.createdAt
    });

    // Add to NeonDB via Prisma
    await addJob(job);
    
    // Verify job was added
    const verifyJob = await getJob(jobId);
    if (!verifyJob) {
      console.error('CRITICAL: Job was not added to database properly!');
      return NextResponse.json(
        { error: 'Failed to create job in database' },
        { status: 500 }
      );
    }
    console.log('Job verified in NeonDB');

    // Debug storage state
    const storageDebug = await debugJobsStorage();
    console.log('Database debug after job creation:', storageDebug);

    // Submit to ComfyUI
    try {
      console.log('🚀 Submitting to ComfyUI...');
      console.log('📝 Workflow preview:', JSON.stringify(workflow).substring(0, 200) + '...');
      
      const comfyUIResponse = await fetch(`${COMFYUI_URL}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: jobId,
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      console.log('🖥️ ComfyUI response status:', comfyUIResponse.status);
      
      if (!comfyUIResponse.ok) {
        const errorText = await comfyUIResponse.text();
        console.error('❌ ComfyUI request failed:', comfyUIResponse.status, errorText);
        throw new Error(`ComfyUI request failed: ${comfyUIResponse.status} - ${errorText}`);
      }

      const result = await comfyUIResponse.json();
      console.log('✅ ComfyUI submission result:', result);
      
      // Update job with ComfyUI prompt ID
      const updates: Partial<GenerationJob> = {
        status: "processing",
        progress: 10,
        lastChecked: new Date().toISOString()
      };
      
      if (result.prompt_id) {
        updates.comfyUIPromptId = result.prompt_id;
        console.log('🔗 ComfyUI prompt ID:', result.prompt_id);
      }

      const updatedJob = await updateJob(jobId, updates);
      if (!updatedJob) {
        console.error('❌ Failed to update job after ComfyUI submission');
      }

      // Track LoRA usage if a LoRA was used
      if (params?.selectedLora && params.selectedLora !== 'None') {
        console.log('📊 Tracking LoRA usage:', params.selectedLora);
        try {
          await incrementInfluencerUsage(clerkId, params.selectedLora);
        } catch (usageError) {
          console.error('⚠️ Error tracking LoRA usage:', usageError);
          // Don't fail the generation if usage tracking fails
        }
      }

      // Start polling ComfyUI for results
      console.log('🔄 Starting ComfyUI polling...');
      pollComfyUIProgress(jobId);

    } catch (error) {
      console.error('❌ ComfyUI submission error:', error);
      await updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : 'ComfyUI submission failed',
        progress: 0
      });
    }

    console.log('✅ Generation request completed, returning job ID:', jobId);
    return NextResponse.json({ 
      success: true,
      jobId,
      message: 'Generation started successfully' 
    });

  } catch (error) {
    console.error('💥 Generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Generation failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      },
      { status: 500 }
    );
  }
}

// Enhanced function to poll ComfyUI for progress and results
async function pollComfyUIProgress(jobId: string) {
  const job = await getJob(jobId);
  if (!job) {
    console.error('❌ Job not found for polling:', jobId);
    return;
  }

  console.log(`🔄 === POLLING START for job ${jobId} ===`);
  let attempts = 0;
  const maxAttempts = 300; // 5 minutes max (300 * 1 second)

  const poll = async () => {
    try {
      attempts++;
      console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
      
      // Update last checked time
      await updateJob(jobId, { lastChecked: new Date().toISOString() });
      
      // Method 1: Check queue status first
      try {
        const queueResponse = await fetch(`${COMFYUI_URL}/queue`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          console.log('📋 Queue status - Running:', queueData.queue_running?.length || 0, 'Pending:', queueData.queue_pending?.length || 0);
          
          // Check if our job is in the running queue
          const isRunning = queueData.queue_running?.some((item: any) => {
            const clientId = item[2]?.client_id || item[1]?.client_id;
            return clientId === jobId;
          });
          
          if (isRunning) {
            await updateJob(jobId, {
              status: "processing",
              progress: Math.min(20 + (attempts * 2), 90)
            });
            console.log('⚙️ Job is running, progress:', Math.min(20 + (attempts * 2), 90));
          }
        }
      } catch (queueError) {
        console.warn('⚠️ Queue check failed:', queueError);
      }

      // Method 2: Check history for completion
      try {
        const historyResponse = await fetch(`${COMFYUI_URL}/history`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          // Look for our job in the history
          for (const [historyJobId, jobData] of Object.entries(historyData)) {
            const jobInfo = jobData as any;
            
            // Check if this is our job
            const matchesClientId = jobInfo.prompt?.[1]?.client_id === jobId;
            const matchesPromptId = historyJobId === jobId;
            const currentJob = await getJob(jobId);
            const matchesComfyUIPromptId = currentJob?.comfyUIPromptId === historyJobId;
            
            if (matchesClientId || matchesPromptId || matchesComfyUIPromptId) {
              console.log('🎯 Found our job in history:', historyJobId);
              
              if (jobInfo.status?.status_str === 'success' && jobInfo.outputs) {
                console.log('✅ Job completed successfully!');
                await processCompletedJob(jobId, jobInfo);
                return; // Stop polling
              } else if (jobInfo.status?.status_str === 'error') {
                console.log('❌ Job failed in ComfyUI');
                await updateJob(jobId, {
                  status: "failed",
                  error: "Generation failed in ComfyUI",
                  progress: 0
                });
                return; // Stop polling
              }
            }
          }
        }
      } catch (historyError) {
        console.warn('⚠️ History check failed:', historyError);
      }

      // Continue polling if not completed and within limits
      if (attempts < maxAttempts) {
        setTimeout(poll, 1000); // Poll every second
      } else {
        console.error('⏰ Polling timeout for job:', jobId);
        await updateJob(jobId, {
          status: "failed",
          error: "Generation timeout - job may still be running in ComfyUI",
          progress: 0
        });
      }

    } catch (error) {
      console.error('💥 Polling error for job', jobId, ':', error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000); // Retry with longer delay
      } else {
        await updateJob(jobId, {
          status: "failed",
          error: "Polling failed: " + (error instanceof Error ? error.message : 'Unknown error'),
          progress: 0
        });
      }
    }
  };

  // Start polling after a short delay
  setTimeout(poll, 2000);
}

async function processCompletedJob(jobId: string, jobData: any): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      console.error('❌ Job not found for completion processing:', jobId);
      return;
    }

    console.log('🎉 Processing completed job:', jobId);
    
    // Extract image URLs from outputs
    const imageUrls: string[] = [];
    
    for (const nodeId in jobData.outputs) {
      const nodeOutput = jobData.outputs[nodeId];
      if (nodeOutput.images) {
        for (const image of nodeOutput.images) {
          const imageUrl = `${COMFYUI_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`;
          imageUrls.push(imageUrl);
          console.log('🖼️ Found image:', image.filename);
        }
      }
    }
    
    const updatedJob = await updateJob(jobId, {
      status: "completed",
      progress: 100,
      resultUrls: imageUrls,
      lastChecked: new Date().toISOString()
    });
    
    if (updatedJob) {
      console.log('✅ Job completed successfully:', jobId, 'Images:', imageUrls.length);
    } else {
      console.error('❌ Failed to update completed job:', jobId);
    }
  } catch (error) {
    console.error('💥 Error processing completed job:', error);
    await updateJob(jobId, {
      status: "failed",
      error: "Failed to process results"
    });
  }
}