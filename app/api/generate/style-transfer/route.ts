// app/api/generate/style-transfer/route.ts - NEW FILE NEEDED
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@clerk/nextjs/server';
import { incrementInfluencerUsage } from '@/lib/database';
import { 
  addJob, 
  getJob, 
  updateJob, 
  type GenerationJob 
} from '@/lib/jobsStorage';
import { 
  saveImageToDatabase, 
  buildComfyUIUrl,
  type ImagePathInfo 
} from '@/lib/imageStorage';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';

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
    
    console.log('=== STYLE TRANSFER GENERATION REQUEST ===');
    console.log('Generating style transfer for Clerk user:', clerkId);
    console.log('ComfyUI URL:', COMFYUI_URL);
    
    const { workflow, params, referenceImage } = await request.json();
    
    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow data' },
        { status: 400 }
      );
    }

    if (!referenceImage) {
      return NextResponse.json(
        { error: 'Missing reference image' },
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
      params: {
        ...params,
        referenceImage,
        generationType: 'style-transfer'
      },
      lastChecked: new Date().toISOString(),
      progress: 0
    };

    console.log('Adding style transfer job to NeonDB...');
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

    // Submit to ComfyUI
    try {
      console.log('🚀 Submitting style transfer to ComfyUI...');
      console.log('📸 Reference image:', referenceImage);
      
      const comfyUIResponse = await fetch(`${COMFYUI_URL}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: jobId,
        }),
        signal: AbortSignal.timeout(10000)
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

      await updateJob(jobId, updates);

      // Track LoRA usage if a LoRA was used
      if (params?.selectedLora && params.selectedLora !== 'None') {
        console.log('📊 Tracking LoRA usage:', params.selectedLora);
        try {
          await incrementInfluencerUsage(clerkId, params.selectedLora);
        } catch (usageError) {
          console.error('⚠️ Error tracking LoRA usage:', usageError);
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

    console.log('✅ Style transfer request completed, returning job ID:', jobId);
    return NextResponse.json({ 
      success: true,
      jobId,
      message: 'Style transfer started successfully' 
    });

  } catch (error) {
    console.error('💥 Style transfer generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Style transfer failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      },
      { status: 500 }
    );
  }
}

// Enhanced polling function for style transfer
async function pollComfyUIProgress(jobId: string) {
  const job = await getJob(jobId);
  if (!job) {
    console.error('❌ Job not found for polling:', jobId);
    return;
  }

  console.log(`🔄 === STYLE TRANSFER POLLING START for job ${jobId} ===`);
  let attempts = 0;
  const maxAttempts = 300; // 5 minutes for style transfer

  const poll = async () => {
    try {
      attempts++;
      console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for style transfer job ${jobId}`);
      
      await updateJob(jobId, { lastChecked: new Date().toISOString() });
      
      // Check queue status
      try {
        const queueResponse = await fetch(`${COMFYUI_URL}/queue`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          const isRunning = queueData.queue_running?.some((item: any) => {
            const clientId = item[2]?.client_id || item[1]?.client_id;
            return clientId === jobId;
          });
          
          if (isRunning) {
            await updateJob(jobId, {
              status: "processing",
              progress: Math.min(20 + (attempts * 2), 90)
            });
            console.log('⚙️ Style transfer job is running, progress:', Math.min(20 + (attempts * 2), 90));
          }
        }
      } catch (queueError) {
        console.warn('⚠️ Queue check failed:', queueError);
      }

      // Check history for completion
      try {
        const historyResponse = await fetch(`${COMFYUI_URL}/history`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          for (const [historyJobId, jobData] of Object.entries(historyData)) {
            const jobInfo = jobData as any;
            
            const matchesClientId = jobInfo.prompt?.[1]?.client_id === jobId;
            const matchesPromptId = historyJobId === jobId;
            const currentJob = await getJob(jobId);
            const matchesComfyUIPromptId = currentJob?.comfyUIPromptId === historyJobId;
            
            if (matchesClientId || matchesPromptId || matchesComfyUIPromptId) {
              console.log('🎯 Found style transfer job in history:', historyJobId);
              
              if (jobInfo.status?.status_str === 'success' && jobInfo.outputs) {
                console.log('✅ Style transfer job completed successfully!');
                await processCompletedStyleTransferJob(jobId, jobInfo);
                return;
              } else if (jobInfo.status?.status_str === 'error') {
                console.log('❌ Style transfer job failed in ComfyUI');
                await updateJob(jobId, {
                  status: "failed",
                  error: "Style transfer failed in ComfyUI",
                  progress: 0
                });
                return;
              }
            }
          }
        }
      } catch (historyError) {
        console.warn('⚠️ History check failed:', historyError);
      }

      // Continue polling
      if (attempts < maxAttempts) {
        setTimeout(poll, 1000);
      } else {
        console.error('⏰ Polling timeout for style transfer job:', jobId);
        await updateJob(jobId, {
          status: "failed",
          error: "Style transfer timeout - job may still be running in ComfyUI",
          progress: 0
        });
      }

    } catch (error) {
      console.error('💥 Polling error for style transfer job', jobId, ':', error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        await updateJob(jobId, {
          status: "failed",
          error: "Polling failed: " + (error instanceof Error ? error.message : 'Unknown error'),
          progress: 0
        });
      }
    }
  };

  setTimeout(poll, 2000);
}

// Process completed style transfer job
async function processCompletedStyleTransferJob(jobId: string, jobData: any): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      console.error('❌ Job not found for completion processing:', jobId);
      return;
    }

    console.log('🎉 Processing completed style transfer job:', jobId);
    
    // Extract image path information from outputs
    const imagePathInfos: ImagePathInfo[] = [];
    const legacyUrls: string[] = []; // Keep for backward compatibility
    
    for (const nodeId in jobData.outputs) {
      const nodeOutput = jobData.outputs[nodeId];
      if (nodeOutput.images) {
        for (const image of nodeOutput.images) {
          // Store path components instead of full URLs
          const pathInfo: ImagePathInfo = {
            filename: image.filename,
            subfolder: image.subfolder || '',
            type: image.type || 'output'
          };
          
          imagePathInfos.push(pathInfo);
          
          // Also build legacy URL for backward compatibility
          const legacyUrl = buildComfyUIUrl(pathInfo);
          legacyUrls.push(legacyUrl);
          
          console.log('🖼️ Found style transfer result:', pathInfo.filename);
        }
      }
    }
    
    console.log('💾 Saving', imagePathInfos.length, 'style transfer results with dynamic URLs...');
    
    // Save each image to the database using path components
    const savedImages = [];
    for (const pathInfo of imagePathInfos) {
      try {
        const savedImage = await saveImageToDatabase(
          job.clerkId,
          jobId,
          pathInfo,
          {
            saveData: true, // Store actual image data
            extractMetadata: true // Extract image metadata
          }
        );
        
        if (savedImage) {
          savedImages.push(savedImage);
          console.log('✅ Saved style transfer result to database:', savedImage.filename);
        } else {
          console.error('❌ Failed to save style transfer result:', pathInfo.filename);
        }
      } catch (imageError) {
        console.error('💥 Error saving individual style transfer result:', pathInfo.filename, imageError);
      }
    }
    
    console.log('📊 Successfully saved', savedImages.length, 'out of', imagePathInfos.length, 'style transfer results');
    
    // Update job with completion status
    const updatedJob = await updateJob(jobId, {
      status: "completed",
      progress: 100,
      resultUrls: legacyUrls, // Keep legacy URLs for backward compatibility
      lastChecked: new Date().toISOString()
    });
    
    if (updatedJob) {
      console.log('✅ Style transfer job completed successfully:', jobId);
      console.log('🖼️ Results in database:', savedImages.length);
      console.log('🔗 Dynamic URLs will be constructed as needed');
    } else {
      console.error('❌ Failed to update completed style transfer job:', jobId);
    }
    
  } catch (error) {
    console.error('💥 Error processing completed style transfer job:', error);
    await updateJob(jobId, {
      status: "failed",
      error: "Failed to process results: " + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}