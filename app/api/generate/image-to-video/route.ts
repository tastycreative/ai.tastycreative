// app/api/generate/image-to-video/route.ts - Image to Video generation with WAN 2.2
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
  saveVideoToDatabase, 
  buildComfyUIVideoUrl,
  type VideoPathInfo 
} from '@/lib/videoStorage';

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
    
    console.log('=== IMAGE TO VIDEO GENERATION REQUEST ===');
    console.log('Generating video for Clerk user:', clerkId);
    console.log('ComfyUI URL:', COMFYUI_URL);
    
    const { workflow, params } = await request.json();
    
    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow data' },
        { status: 400 }
      );
    }

    if (!params.uploadedImage) {
      return NextResponse.json(
        { error: 'Missing uploaded image' },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    console.log('Created I2V job ID:', jobId);
    
    // Create job with Clerk user ID
    const job: GenerationJob = {
      id: jobId,
      clerkId,
      userId: clerkId,
      status: "pending",
      createdAt: new Date(),
      params,
      lastChecked: new Date().toISOString(),
      progress: 0,
      type: "image-to-video"
    };

    console.log('Adding I2V job to NeonDB...');
    await addJob(job);
    
    // Verify job was added
    const verifyJob = await getJob(jobId);
    if (!verifyJob) {
      console.error('CRITICAL: I2V Job was not added to database properly!');
      return NextResponse.json(
        { error: 'Failed to create job in database' },
        { status: 500 }
      );
    }
    console.log('I2V Job verified in NeonDB');

    // Submit to ComfyUI
    try {
      console.log('🚀 Submitting I2V workflow to ComfyUI...');
      
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

      console.log('🖥️ ComfyUI I2V response status:', comfyUIResponse.status);
      
      if (!comfyUIResponse.ok) {
        const errorText = await comfyUIResponse.text();
        console.error('❌ ComfyUI I2V request failed:', comfyUIResponse.status, errorText);
        throw new Error(`ComfyUI request failed: ${comfyUIResponse.status} - ${errorText}`);
      }

      const result = await comfyUIResponse.json();
      console.log('✅ ComfyUI I2V submission result:', result);
      
      // Update job with ComfyUI prompt ID
      const updates: Partial<GenerationJob> = {
        status: "processing",
        progress: 10,
        lastChecked: new Date().toISOString()
      };
      
      if (result.prompt_id) {
        updates.comfyUIPromptId = result.prompt_id;
        console.log('🔗 ComfyUI I2V prompt ID:', result.prompt_id);
      }

      await updateJob(jobId, updates);

      // Track LoRA usage if a LoRA was used
      if (params?.selectedLora && params.selectedLora !== 'None') {
        console.log('📊 Tracking I2V LoRA usage:', params.selectedLora);
        try {
          await incrementInfluencerUsage(clerkId, params.selectedLora);
        } catch (usageError) {
          console.error('⚠️ Error tracking I2V LoRA usage:', usageError);
        }
      }

      // Start polling ComfyUI for results
      console.log('🔄 Starting ComfyUI I2V polling...');
      pollComfyUIProgress(jobId);

    } catch (error) {
      console.error('❌ ComfyUI I2V submission error:', error);
      await updateJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : 'ComfyUI submission failed',
        progress: 0
      });
    }

    console.log('✅ I2V Generation request completed, returning job ID:', jobId);
    return NextResponse.json({ 
      success: true,
      jobId,
      message: 'Image to video generation started successfully' 
    });

  } catch (error) {
    console.error('💥 I2V Generation error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Image to video generation failed: ' + (error instanceof Error ? error.message : 'Unknown error') 
      },
      { status: 500 }
    );
  }
}

// Enhanced polling function for video generation
async function pollComfyUIProgress(jobId: string) {
  const job = await getJob(jobId);
  if (!job) {
    console.error('❌ I2V Job not found for polling:', jobId);
    return;
  }

  console.log(`🔄 === I2V POLLING START for job ${jobId} ===`);
  let attempts = 0;
  const maxAttempts = 600; // 10 minutes for video generation

  const poll = async () => {
    try {
      attempts++;
      console.log(`🔍 I2V Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
      
      await updateJob(jobId, { lastChecked: new Date().toISOString() });
      
      // Check queue status
      try {
        const queueResponse = await fetch(`${COMFYUI_URL}/queue`, {
          method: 'GET',
          signal: AbortSignal.timeout(8000)
        });
        
        if (queueResponse.ok) {
          const queueData = await queueResponse.json();
          const isRunning = queueData.queue_running?.some((item: any) => {
            const clientId = item[2]?.client_id || item[1]?.client_id;
            return clientId === jobId;
          });
          
          if (isRunning) {
            const progressEstimate = Math.min(20 + (attempts * 0.5), 85);
            await updateJob(jobId, {
              status: "processing",
              progress: progressEstimate
            });
            console.log('⚙️ I2V Job is running, progress:', progressEstimate);
          }
        }
      } catch (queueError) {
        console.warn('⚠️ I2V Queue check failed:', queueError);
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
            
            const matchesClientId = jobInfo.prompt?.[1]?.client_id === jobId;
            const matchesPromptId = historyJobId === jobId;
            const currentJob = await getJob(jobId);
            const matchesComfyUIPromptId = currentJob?.comfyUIPromptId === historyJobId;
            
            if (matchesClientId || matchesPromptId || matchesComfyUIPromptId) {
              console.log('🎯 Found our I2V job in history:', historyJobId);
              
              if (jobInfo.status?.status_str === 'success' && jobInfo.outputs) {
                console.log('✅ I2V Job completed successfully!');
                await processCompletedVideoJob(jobId, jobInfo);
                return;
              } else if (jobInfo.status?.status_str === 'error') {
                console.log('❌ I2V Job failed in ComfyUI');
                await updateJob(jobId, {
                  status: "failed",
                  error: "Video generation failed in ComfyUI",
                  progress: 0
                });
                return;
              }
            }
          }
        }
      } catch (historyError) {
        console.warn('⚠️ I2V History check failed:', historyError);
      }

      // Continue polling with longer intervals for video generation
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000); // 2 second intervals
      } else {
        console.error('⏰ I2V Polling timeout for job:', jobId);
        await updateJob(jobId, {
          status: "failed",
          error: "Video generation timeout - job may still be running in ComfyUI",
          progress: 0
        });
      }

    } catch (error) {
      console.error('💥 I2V Polling error for job', jobId, ':', error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 3000); // Longer delay on error
      } else {
        await updateJob(jobId, {
          status: "failed",
          error: "Polling failed: " + (error instanceof Error ? error.message : 'Unknown error'),
          progress: 0
        });
      }
    }
  };

  setTimeout(poll, 3000); // Start after 3 seconds
}

// Process completed video job
async function processCompletedVideoJob(jobId: string, jobData: any): Promise<void> {
  try {
    const job = await getJob(jobId);
    if (!job) {
      console.error('❌ I2V Job not found for completion processing:', jobId);
      return;
    }

    console.log('🎉 Processing completed I2V job:', jobId);
    
    // Extract video path information from outputs
    const videoPathInfos: VideoPathInfo[] = [];
    const legacyUrls: string[] = []; // Keep for backward compatibility
    
    for (const nodeId in jobData.outputs) {
      const nodeOutput = jobData.outputs[nodeId];
      
      // Look for video outputs (SaveVideo node outputs)
      if (nodeOutput.videos) {
        for (const video of nodeOutput.videos) {
          const pathInfo: VideoPathInfo = {
            filename: video.filename,
            subfolder: video.subfolder || '',
            type: video.type || 'output'
          };
          
          videoPathInfos.push(pathInfo);
          
          // Build legacy URL for backward compatibility
          const legacyUrl = buildComfyUIVideoUrl(pathInfo);
          legacyUrls.push(legacyUrl);
          
          console.log('🎬 Found video:', pathInfo.filename);
        }
      }
      
      // Also check for gifs or other video formats
      if (nodeOutput.gifs) {
        for (const gif of nodeOutput.gifs) {
          const pathInfo: VideoPathInfo = {
            filename: gif.filename,
            subfolder: gif.subfolder || '',
            type: gif.type || 'output'
          };
          
          videoPathInfos.push(pathInfo);
          
          const legacyUrl = buildComfyUIVideoUrl(pathInfo);
          legacyUrls.push(legacyUrl);
          
          console.log('🎞️ Found GIF:', pathInfo.filename);
        }
      }
    }
    
    console.log('💾 Saving', videoPathInfos.length, 'videos with dynamic URLs...');
    
    // Save each video to the database
    const savedVideos = [];
    for (const pathInfo of videoPathInfos) {
      try {
        const savedVideo = await saveVideoToDatabase(
          job.clerkId,
          jobId,
          pathInfo,
          {
            saveData: true, // Store actual video data
            extractMetadata: true // Extract video metadata
          }
        );
        
        if (savedVideo) {
          savedVideos.push(savedVideo);
          console.log('✅ Saved video to database:', savedVideo.filename);
        } else {
          console.error('❌ Failed to save video:', pathInfo.filename);
        }
      } catch (videoError) {
        console.error('💥 Error saving individual video:', pathInfo.filename, videoError);
      }
    }
    
    console.log('📊 Successfully saved', savedVideos.length, 'out of', videoPathInfos.length, 'videos');
    
    // Update job with completion status
    const updatedJob = await updateJob(jobId, {
      status: "completed",
      progress: 100,
      resultUrls: legacyUrls, // Keep legacy URLs for backward compatibility
      lastChecked: new Date().toISOString()
    });
    
    if (updatedJob) {
      console.log('✅ I2V Job completed successfully:', jobId);
      console.log('🎬 Videos in database:', savedVideos.length);
      console.log('🔗 Dynamic URLs will be constructed as needed');
    } else {
      console.error('❌ Failed to update completed I2V job:', jobId);
    }
    
  } catch (error) {
    console.error('💥 Error processing completed I2V job:', error);
    await updateJob(jobId, {
      status: "failed",
      error: "Failed to process video results: " + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}