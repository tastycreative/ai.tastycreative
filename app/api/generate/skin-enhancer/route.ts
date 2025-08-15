// app/api/generate/skin-enhancer/route.ts - Skin Enhancer with dynamic URL storage
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
    
    console.log('=== SKIN ENHANCEMENT REQUEST ===');
    console.log('Enhancing skin for Clerk user:', clerkId);
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

    console.log('Adding skin enhancement job to NeonDB...');
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
      console.log('🚀 Submitting skin enhancer to ComfyUI...');
      
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

      // Track influencer LoRA usage if used
      if (params?.selectedInfluencerLora && params.selectedInfluencerLora !== 'None') {
        console.log('📊 Tracking influencer LoRA usage:', params.selectedInfluencerLora);
        try {
          await incrementInfluencerUsage(clerkId, params.selectedInfluencerLora);
        } catch (usageError) {
          console.error('⚠️ Error tracking LoRA usage:', usageError);
        }
      }

      // Start polling ComfyUI for results
      console.log('🔄 Starting ComfyUI polling for skin enhancement...');
      pollComfyUIProgress(jobId);

    } catch (error) {
      console.error('❌ ComfyUI submission error:', error);
      await updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : 'ComfyUI submission failed',
        progress: 0
      });
    }

    console.log('✅ Skin enhancement request completed, returning job ID:', jobId);
    return NextResponse.json({ 
      success: true,
      jobId,
      message: 'Skin enhancement started successfully' 
    });

  } catch (error) {
    console.error('💥 Skin enhancement error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Skin enhancement failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      },
      { status: 500 }
    );
  }
}

// Enhanced polling function for skin enhancement with dynamic URL storage
async function pollComfyUIProgress(jobId: string) {
  const job = await getJob(jobId);
  if (!job) {
    console.error('❌ Job not found for polling:', jobId);
    return;
  }

  console.log(`🔄 === SKIN ENHANCEMENT POLLING START for job ${jobId} ===`);
  let attempts = 0;
  const maxAttempts = 300; // 5 minutes for skin enhancement (more complex workflow)

  const poll = async () => {
    try {
      attempts++;
      console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for skin enhancement job ${jobId}`);
      
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
            const progress = Math.min(20 + (attempts * 1.5), 90); // Slower progress for complex workflow
            await updateJob(jobId, {
              status: "processing",
              progress: Math.round(progress)
            });
            console.log('⚙️ Skin enhancement job is running, progress:', Math.round(progress));
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
              console.log('🎯 Found skin enhancement job in history:', historyJobId);
              
              if (jobInfo.status?.status_str === 'success' && jobInfo.outputs) {
                console.log('✅ Skin enhancement job completed successfully!');
                await processSkinEnhancementCompletion(jobId, jobInfo);
                return;
              } else if (jobInfo.status?.status_str === 'error') {
                console.log('❌ Skin enhancement job failed in ComfyUI');
                await updateJob(jobId, {
                  status: "failed",
                  error: "Skin enhancement failed in ComfyUI",
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
        setTimeout(poll, 2000); // Longer interval for complex workflow
      } else {
        console.error('⏰ Polling timeout for skin enhancement job:', jobId);
        await updateJob(jobId, {
          status: "failed",
          error: "Skin enhancement timeout - job may still be running in ComfyUI",
          progress: 0
        });
      }

    } catch (error) {
      console.error('💥 Polling error for skin enhancement job', jobId, ':', error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 3000); // Even longer retry delay
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

// Updated processSkinEnhancementCompletion function with dynamic URL storage
async function processSkinEnhancementCompletion(jobId: string, jobData: any): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      console.error('❌ Job not found for skin enhancement completion processing:', jobId);
      return;
    }

    console.log('🎉 Processing completed skin enhancement job with dynamic URL storage:', jobId);
    
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
          
          console.log('🖼️ Found skin enhanced image:', pathInfo.filename);
        }
      }
    }
    
    console.log('💾 Saving', imagePathInfos.length, 'skin enhanced images with dynamic URLs...');
    
    // Save each image to the database using path components
    const savedImages = [];
    for (const pathInfo of imagePathInfos) {
      try {
        const savedImage = await saveImageToDatabase(
          job.clerkId,
          jobId,
          pathInfo,
          {
            saveData: true, // Store actual image data for skin enhanced images
            extractMetadata: true // Extract image metadata
          }
        );
        
        if (savedImage) {
          savedImages.push(savedImage);
          console.log('✅ Saved skin enhanced image to database:', savedImage.filename);
        } else {
          console.error('❌ Failed to save skin enhanced image:', pathInfo.filename);
        }
      } catch (imageError) {
        console.error('💥 Error saving individual skin enhanced image:', pathInfo.filename, imageError);
      }
    }
    
    console.log('📊 Successfully saved', savedImages.length, 'out of', imagePathInfos.length, 'skin enhanced images');
    
    // Update job with completion status
    const updatedJob = await updateJob(jobId, {
      status: "completed",
      progress: 100,
      resultUrls: legacyUrls, // Keep legacy URLs for backward compatibility
      lastChecked: new Date().toISOString()
    });
    
    if (updatedJob) {
      console.log('✅ Skin enhancement job completed successfully:', jobId);
      console.log('🖼️ Enhanced images in database:', savedImages.length);
      console.log('🔗 Dynamic URLs will be constructed as needed');
    } else {
      console.error('❌ Failed to update completed skin enhancement job:', jobId);
    }
    
  } catch (error) {
    console.error('💥 Error processing completed skin enhancement job:', error);
    await updateJob(jobId, {
      status: "failed",
      error: "Failed to process skin enhancement results: " + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}