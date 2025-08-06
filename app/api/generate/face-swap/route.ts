// app/api/generate/face-swap/route.ts - Updated for exact workflow structure
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
    
    console.log('=== ACE++ FACE SWAP GENERATION REQUEST ===');
    console.log('Generating face swap for Clerk user:', clerkId);
    console.log('ComfyUI URL:', COMFYUI_URL);
    console.log('Using FLUX Fill + ACE++ Pipeline');
    
    const { workflow, params, type } = await request.json();
    
    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow data' },
        { status: 400 }
      );
    }

    if (!params?.sourceImage || !params?.targetImage) {
      return NextResponse.json(
        { error: 'Missing source or target image' },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    console.log('Created ACE++ face swap job ID:', jobId);
    
    // Log workflow details
    console.log('📋 Face swap parameters:');
    console.log('  - Target Image (Node 239):', params.targetImage);
    console.log('  - Source Face (Node 240):', params.sourceImage);
    console.log('  - Additional LoRA:', params.selectedLora);
    console.log('  - Prompt:', params.prompt);
    console.log('  - Guidance:', params.guidance);
    console.log('  - Steps:', params.steps);
    console.log('  - CFG:', params.cfg);
    console.log('  - TeaCache enabled:', params.useTeaCache);
    console.log('  - Context expand:', params.contextExpandPixels, 'px');
    
    // Create job with Clerk user ID
    const job: GenerationJob = {
      id: jobId,
      clerkId,
      userId: clerkId,
      status: "pending",
      createdAt: new Date(),
      params: {
        ...params,
        generationType: 'ace-face-swap',
        workflowVersion: 'ACE++_v4'
      },
      lastChecked: new Date().toISOString(),
      progress: 0
    };

    console.log('Adding ACE++ face swap job to NeonDB...');
    await addJob(job);
    
    // Verify job was added
    const verifyJob = await getJob(jobId);
    if (!verifyJob) {
      console.error('CRITICAL: ACE++ face swap job was not added to database properly!');
      return NextResponse.json(
        { error: 'Failed to create job in database' },
        { status: 500 }
      );
    }
    console.log('ACE++ face swap job verified in NeonDB');

    // Submit to ComfyUI
    try {
      console.log('🚀 Submitting ACE++ face swap to ComfyUI...');
      console.log('📸 Workflow nodes summary:');
      console.log('  - UNETLoader (340): Flux-FillDevFP8.safetensors');
      console.log('  - Power LoRA Loader (337): Portrait + Turbo + Optional');
      console.log('  - FluxGuidance (345):', params.guidance);
      console.log('  - KSampler (346): Euler,', params.steps, 'steps, CFG', params.cfg);
      console.log('  - TeaCache (416):', params.useTeaCache ? 'Enabled' : 'Disabled');
      
      const comfyUIResponse = await fetch(`${COMFYUI_URL}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: workflow,
          client_id: jobId,
        }),
        signal: AbortSignal.timeout(15000)
      });

      console.log('🖥️ ComfyUI ACE++ face swap response status:', comfyUIResponse.status);
      
      if (!comfyUIResponse.ok) {
        const errorText = await comfyUIResponse.text();
        console.error('❌ ComfyUI ACE++ face swap request failed:', comfyUIResponse.status, errorText);
        
        // Try to parse error details
        let errorDetails = `ComfyUI request failed: ${comfyUIResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorDetails += ` - ${errorJson.error}`;
          }
        } catch (e) {
          errorDetails += ` - ${errorText.substring(0, 200)}`;
        }
        
        throw new Error(errorDetails);
      }

      const result = await comfyUIResponse.json();
      console.log('✅ ComfyUI ACE++ face swap submission result:', result);
      
      // Update job with ComfyUI prompt ID
      const updates: Partial<GenerationJob> = {
        status: "processing",
        progress: 15,
        lastChecked: new Date().toISOString()
      };
      
      if (result.prompt_id) {
        updates.comfyUIPromptId = result.prompt_id;
        console.log('🔗 ComfyUI prompt ID:', result.prompt_id);
      }

      await updateJob(jobId, updates);

      // Track LoRA usage for additional LoRA if used
      if (params?.selectedLora && params.selectedLora !== 'None') {
        console.log('📊 Tracking additional LoRA usage:', params.selectedLora);
        try {
          await incrementInfluencerUsage(clerkId, params.selectedLora);
          console.log('✅ LoRA usage tracked successfully');
        } catch (usageError) {
          console.error('⚠️ Error tracking LoRA usage:', usageError);
        }
      }

      // Always track the portrait LoRA usage (it's always used)
      try {
        await incrementInfluencerUsage(clerkId, 'comfyui_portrait_lora64.safetensors');
        console.log('📊 Portrait LoRA usage tracked');
      } catch (usageError) {
        console.error('⚠️ Error tracking portrait LoRA usage:', usageError);
      }

      // Start polling ComfyUI for results
      console.log('🔄 Starting ComfyUI ACE++ face swap polling...');
      pollComfyUIACEFaceSwapProgress(jobId);

    } catch (error) {
      console.error('❌ ComfyUI ACE++ face swap submission error:', error);
      await updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : 'ComfyUI submission failed',
        progress: 0
      });
    }

    console.log('✅ ACE++ face swap request completed, returning job ID:', jobId);
    return NextResponse.json({ 
      success: true,
      jobId,
      message: 'ACE++ face swap started successfully',
      workflowType: 'FLUX Fill + ACE++ Pipeline'
    });

  } catch (error) {
    console.error('💥 ACE++ face swap generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'ACE++ face swap failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      },
      { status: 500 }
    );
  }
}

// Enhanced polling function for ACE++ face swap
async function pollComfyUIACEFaceSwapProgress(jobId: string) {
  const job = await getJob(jobId);
  if (!job) {
    console.error('❌ Job not found for ACE++ face swap polling:', jobId);
    return;
  }

  console.log(`🔄 === ACE++ FACE SWAP POLLING START for job ${jobId} ===`);
  console.log('🎯 Expected output: AceFaceSwap/Faceswap_*.png');
  
  let attempts = 0;
  const maxAttempts = 480; // 8 minutes for ACE++ face swap (complex pipeline)

  const poll = async () => {
    try {
      attempts++;
      console.log(`🔍 ACE++ polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
      
      await updateJob(jobId, { lastChecked: new Date().toISOString() });
      
      // Check queue status first
      try {
        const queueResponse = await fetch(`${COMFYUI_URL}/queue`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          
          // Check if job is in running queue
          const isRunning = queueData.queue_running?.some((item: any) => {
            const clientId = item[2]?.client_id || item[1]?.client_id;
            return clientId === jobId;
          });
          
          // Check if job is in pending queue
          const isPending = queueData.queue_pending?.some((item: any) => {
            const clientId = item[2]?.client_id || item[1]?.client_id;
            return clientId === jobId;
          });
          
          if (isRunning) {
            // Job is actively processing
            const progress = Math.min(25 + Math.floor(attempts * 1.5), 85);
            await updateJob(jobId, {
              status: "processing",
              progress: progress
            });
            console.log('⚙️ ACE++ face swap job is running, progress:', progress + '%');
            console.log('🎛️ Pipeline stages: Crop → InPaint → Stitch → Output');
          } else if (isPending) {
            // Job is waiting in queue
            await updateJob(jobId, {
              status: "processing",
              progress: 20
            });
            console.log('⏳ ACE++ face swap job is pending in queue');
          }
        }
      } catch (queueError) {
        console.warn('⚠️ Queue check failed:', queueError);
      }

      // Check history for completion
      try {
        const historyResponse = await fetch(`${COMFYUI_URL}/history`, {
          method: 'GET',
          signal: AbortSignal.timeout(15000)
        });
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          for (const [historyJobId, jobData] of Object.entries(historyData)) {
            const jobInfo = jobData as any;
            
            // Multiple ways to match the job
            const matchesClientId = jobInfo.prompt?.[1]?.client_id === jobId;
            const matchesPromptId = historyJobId === jobId;
            const currentJob = await getJob(jobId);
            const matchesComfyUIPromptId = currentJob?.comfyUIPromptId === historyJobId;
            
            if (matchesClientId || matchesPromptId || matchesComfyUIPromptId) {
              console.log('🎯 Found ACE++ face swap job in history:', historyJobId);
              console.log('📊 Job status:', jobInfo.status?.status_str);
              
              if (jobInfo.status?.status_str === 'success' && jobInfo.outputs) {
                console.log('✅ ACE++ face swap job completed successfully!');
                console.log('🔍 Processing outputs from nodes...');
                
                // Log available outputs for debugging
                const outputNodes = Object.keys(jobInfo.outputs);
                console.log('📋 Output nodes:', outputNodes);
                
                await processCompletedACEFaceSwapJob(jobId, jobInfo);
                return;
                
              } else if (jobInfo.status?.status_str === 'error') {
                console.log('❌ ACE++ face swap job failed in ComfyUI');
                console.log('🔍 Error details:', jobInfo.status);
                
                // Try to extract detailed error information
                let errorDetails = 'ACE++ face swap failed in ComfyUI';
                
                if (jobInfo.status?.messages) {
                  const errorMessages = jobInfo.status.messages
                    .filter((msg: any) => msg[0] === 'error')
                    .map((msg: any) => msg[1]);
                  if (errorMessages.length > 0) {
                    errorDetails += ': ' + errorMessages.join(', ');
                  }
                }
                
                // Check for node-specific errors
                if (jobInfo.status?.exception_message) {
                  errorDetails += ' - ' + jobInfo.status.exception_message;
                }
                
                await updateJob(jobId, {
                  status: "failed",
                  error: errorDetails,
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

      // Continue polling if not completed and under limit
      if (attempts < maxAttempts) {
        // Progressive interval: start fast, slow down over time
        const interval = attempts < 60 ? 2000 : attempts < 180 ? 3000 : 5000;
        setTimeout(poll, interval);
      } else {
        console.error('⏰ Polling timeout for ACE++ face swap job:', jobId);
        console.log('📊 Final stats: Polled for', (attempts * 2) / 60, 'minutes');
        
        await updateJob(jobId, {
          status: "failed",
          error: "ACE++ face swap timeout - job may still be processing in ComfyUI. This is a complex pipeline that can take time.",
          progress: 0
        });
      }

    } catch (error) {
      console.error('💥 Polling error for ACE++ face swap job', jobId, ':', error);
      
      if (attempts < maxAttempts) {
        // Retry with longer interval on error
        setTimeout(poll, 5000);
      } else {
        await updateJob(jobId, {
          status: "failed",
          error: "Polling failed: " + (error instanceof Error ? error.message : 'Unknown error'),
          progress: 0
        });
      }
    }
  };

  // Start polling after initial delay
  setTimeout(poll, 3000);
}

// Process completed ACE++ face swap job
async function processCompletedACEFaceSwapJob(jobId: string, jobData: any): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      console.error('❌ Job not found for ACE++ completion processing:', jobId);
      return;
    }

    console.log('🎉 Processing completed ACE++ face swap job:', jobId);
    console.log('📊 Job execution time:', new Date().getTime() - new Date(job.createdAt).getTime(), 'ms');
    
    // Extract image path information from outputs
    const imagePathInfos: ImagePathInfo[] = [];
    const legacyUrls: string[] = []; // Keep for backward compatibility
    
    // Process all output nodes
    for (const nodeId in jobData.outputs) {
      const nodeOutput = jobData.outputs[nodeId];
      console.log(`🔍 Processing output node ${nodeId}:`, nodeOutput);
      
      if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
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
          
          console.log('🖼️ Found ACE++ face swap result:', {
            filename: pathInfo.filename,
            subfolder: pathInfo.subfolder,
            type: pathInfo.type,
            nodeId: nodeId
          });
        }
      }
    }
    
    console.log('📈 ACE++ Results Summary:');
    console.log('  - Total images found:', imagePathInfos.length);
    console.log('  - Expected prefix: AceFaceSwap/Faceswap_');
    console.log('  - Saving with dynamic URL construction...');
    
    if (imagePathInfos.length === 0) {
      console.warn('⚠️ No images found in job outputs!');
      console.log('🔍 Available output nodes:', Object.keys(jobData.outputs));
      
      // Still mark as completed but with a warning
      await updateJob(jobId, {
        status: "completed",
        progress: 100,
        resultUrls: [],
        error: "Job completed but no output images were found",
        lastChecked: new Date().toISOString()
      });
      return;
    }
    
    // Save each image to the database using path components
    const savedImages = [];
    for (const pathInfo of imagePathInfos) {
      try {
        console.log('💾 Saving ACE++ result:', pathInfo.filename);
        
        const savedImage = await saveImageToDatabase(
          job.clerkId,
          jobId,
          pathInfo,
          {
            saveData: true, // Store actual image data for face swaps
            extractMetadata: true // Extract image metadata
          }
        );
        
        if (savedImage) {
          savedImages.push(savedImage);
          console.log('✅ Saved ACE++ result to database:', {
            id: savedImage.id,
            filename: savedImage.filename,
            size: savedImage.fileSize ? `${Math.round(savedImage.fileSize / 1024)}KB` : 'unknown'
          });
        } else {
          console.error('❌ Failed to save ACE++ result:', pathInfo.filename);
        }
      } catch (imageError) {
        console.error('💥 Error saving individual ACE++ result:', pathInfo.filename, imageError);
      }
    }
    
    console.log('📊 ACE++ Save Results:');
    console.log('  - Successfully saved:', savedImages.length, 'out of', imagePathInfos.length);
    console.log('  - Total data stored:', savedImages.reduce((sum, img) => sum + (img.fileSize || 0), 0), 'bytes');
    
    // Update job with completion status
    const updatedJob = await updateJob(jobId, {
      status: "completed",
      progress: 100,
      resultUrls: legacyUrls, // Keep legacy URLs for backward compatibility
      lastChecked: new Date().toISOString()
    });
    
    if (updatedJob) {
      const completionTime = new Date().getTime() - new Date(job.createdAt).getTime();
      console.log('✅ ACE++ face swap job completed successfully:', jobId);
      console.log('🖼️ Results in database:', savedImages.length);
      console.log('⏱️ Total processing time:', Math.round(completionTime / 1000), 'seconds');
      console.log('🔗 Dynamic URLs will be constructed as needed');
      
      // Log successful ACE++ face swap for analytics
      console.log('📈 ACE++ Face swap analytics:', {
        jobId,
        userId: job.clerkId,
        targetImage: job.params?.targetImage,
        sourceImage: job.params?.sourceImage,
        additionalLora: job.params?.selectedLora,
        useTeaCache: job.params?.useTeaCache,
        guidance: job.params?.guidance,
        steps: job.params?.steps,
        resultCount: savedImages.length,
        processingTimeMs: completionTime,
        workflowVersion: 'ACE++_v4',
        completionTime: new Date().toISOString()
      });
      
    } else {
      console.error('❌ Failed to update completed ACE++ face swap job:', jobId);
    }
    
  } catch (error) {
    console.error('💥 Error processing completed ACE++ face swap job:', error);
    await updateJob(jobId, {
      status: "failed",
      error: "Failed to process ACE++ face swap results: " + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}