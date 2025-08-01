// app/api/generate/text-to-image/route.ts (Updated with user LoRA validation)
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Types
interface GenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  resultUrls?: string[];
  error?: string;
  promptId?: string;
  createdAt: Date;
  userId?: string;
  usedLoRA?: string; // Track which LoRA was used
}

// In-memory job storage (use Redis in production)
const jobs: Map<string, GenerationJob> = new Map();

// Import influencers database for validation
const influencersDb: Map<string, any[]> = new Map();

// Environment variables
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

// Helper to get user ID
function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'default-user';
}

// Validate that user can use the specified LoRA
async function validateUserLoRA(userId: string, loraName: string): Promise<boolean> {
  if (loraName === "None") {
    return true; // Everyone can use the base model
  }
  
  const userInfluencers = influencersDb.get(userId) || [];
  const hasLoRA = userInfluencers.some(inf => 
    inf.fileName === loraName && inf.isActive
  );
  
  return hasLoRA;
}

// Increment LoRA usage count
async function incrementLoRAUsage(userId: string, loraName: string) {
  if (loraName === "None") return;
  
  const userInfluencers = influencersDb.get(userId) || [];
  const influencerIndex = userInfluencers.findIndex(inf => inf.fileName === loraName);
  
  if (influencerIndex !== -1) {
    userInfluencers[influencerIndex].usageCount = (userInfluencers[influencerIndex].usageCount || 0) + 1;
    userInfluencers[influencerIndex].lastUsedAt = new Date().toISOString();
    influencersDb.set(userId, userInfluencers);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Text-to-Image Generation Started ===');
    
    const userId = getUserId(request);
    const { workflow, params } = await request.json();
    
    console.log('Received params for user:', userId, params);
    
    // Validate required fields
    if (!workflow || !params?.prompt) {
      console.error('Missing workflow or prompt');
      return NextResponse.json(
        { error: 'Missing workflow or prompt' },
        { status: 400 }
      );
    }
    
    // Validate user can use the specified LoRA
    const selectedLoRA = params.selectedLora || "None";
    const canUseLoRA = await validateUserLoRA(userId, selectedLoRA);
    
    if (!canUseLoRA) {
      console.error('User not authorized for LoRA:', selectedLoRA);
      return NextResponse.json(
        { error: `You are not authorized to use the LoRA model: ${selectedLoRA}` },
        { status: 403 }
      );
    }
    
    console.log('LoRA validation passed:', selectedLoRA);

    // Generate unique job ID
    const jobId = uuidv4();
    const clientId = uuidv4(); // ComfyUI client ID
    console.log('Generated job ID:', jobId);
    
    // Create job record
    const job: GenerationJob = {
      id: jobId,
      status: 'pending',
      createdAt: new Date(),
      userId,
      usedLoRA: selectedLoRA
    };
    
    jobs.set(jobId, job);
    console.log('Job created and stored');

    // Prepare ComfyUI request
    const comfyUIPayload = {
      prompt: workflow,
      client_id: clientId,
    };

    console.log('Submitting to ComfyUI:', `${COMFYUI_URL}/prompt`);
    console.log('Workflow keys:', Object.keys(workflow));

    // Submit to ComfyUI
    const promptResponse = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(comfyUIPayload),
    });

    console.log('ComfyUI response status:', promptResponse.status);

    if (!promptResponse.ok) {
      const errorText = await promptResponse.text();
      console.error('ComfyUI API error:', errorText);
      
      job.status = 'failed';
      job.error = `ComfyUI API error: ${errorText}`;
      jobs.set(jobId, job);
      
      return NextResponse.json(
        { error: 'Failed to submit to ComfyUI', details: errorText },
        { status: 500 }
      );
    }

    const promptResult = await promptResponse.json();
    console.log('ComfyUI response:', promptResult);
    
    const promptId = promptResult.prompt_id;
    
    if (!promptId) {
      console.error('No prompt_id in ComfyUI response');
      job.status = 'failed';
      job.error = 'Invalid ComfyUI response';
      jobs.set(jobId, job);
      
      return NextResponse.json(
        { error: 'Invalid ComfyUI response' },
        { status: 500 }
      );
    }

    // Update job with prompt ID
    job.promptId = promptId;
    job.status = 'processing';
    jobs.set(jobId, job);
    console.log('Job updated with prompt ID:', promptId);

    // Increment LoRA usage count
    await incrementLoRAUsage(userId, selectedLoRA);

    // Start monitoring job in background
    monitorComfyUIJob(jobId, promptId, clientId);

    return NextResponse.json({ 
      jobId,
      status: 'submitted',
      message: 'Generation started successfully'
    });

  } catch (error) {
    console.error('Text-to-image generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Monitor ComfyUI job progress (updated to handle user context)
async function monitorComfyUIJob(jobId: string, promptId: string, clientId: string) {
  console.log(`=== Starting monitoring for job ${jobId}, prompt ${promptId} ===`);
  
  const maxAttempts = 120; // 2 minutes
  let attempts = 0;

  const checkStatus = async () => {
    try {
      const job = jobs.get(jobId);
      if (!job) {
        console.log('Job no longer exists, stopping monitoring');
        return;
      }

      console.log(`Checking status attempt ${attempts + 1}/${maxAttempts} for job ${jobId}`);

      // Check queue status
      const queueResponse = await fetch(`${COMFYUI_URL}/queue`);
      
      if (!queueResponse.ok) {
        throw new Error(`Queue API returned ${queueResponse.status}`);
      }
      
      const queueData = await queueResponse.json();
      console.log('Queue data:', {
        running: queueData.queue_running?.length || 0,
        pending: queueData.queue_pending?.length || 0
      });
      
      // Check if job is still in queue
      const isInRunning = queueData.queue_running?.some((item: any) => item[1] === promptId);
      const isInPending = queueData.queue_pending?.some((item: any) => item[1] === promptId);
      const isInQueue = isInRunning || isInPending;

      if (isInQueue) {
        console.log('Job still in queue, updating progress');
        // Job is still processing
        const queuePosition = queueData.queue_pending?.findIndex((item: any) => item[1] === promptId) || -1;
        
        if (queuePosition >= 0) {
          job.progress = Math.max(10, 100 - (queuePosition + 1) * 20);
        } else if (isInRunning) {
          job.progress = 75; // Currently running
        } else {
          job.progress = 50; // In queue
        }
        
        jobs.set(jobId, job);
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000); // Check every 2 seconds
        } else {
          console.log('Max attempts reached, marking as failed');
          job.status = 'failed';
          job.error = 'Generation timeout';
          jobs.set(jobId, job);
        }
        return;
      }

      console.log('Job no longer in queue, checking history');

      // Job completed, get results
      const historyResponse = await fetch(`${COMFYUI_URL}/history/${promptId}`);
      
      if (!historyResponse.ok) {
        throw new Error(`History API returned ${historyResponse.status}`);
      }
      
      const historyData = await historyResponse.json();
      console.log('History data keys:', Object.keys(historyData));
      
      if (historyData[promptId]) {
        console.log('Found job in history');
        const jobHistory = historyData[promptId];
        
        if (jobHistory.status?.status_str === 'error') {
          console.error('Job failed with error:', jobHistory.status);
          job.status = 'failed';
          job.error = 'Generation failed in ComfyUI';
          jobs.set(jobId, job);
          return;
        }

        const outputs = jobHistory.outputs;
        console.log('Job outputs:', Object.keys(outputs || {}));
        
        // Find SaveImage node outputs (usually node 13 in your workflow)
        let imageOutputs: any = null;
        
        // Try to find outputs with images
        for (const [nodeId, output] of Object.entries(outputs || {})) {
          if ((output as any)?.images && Array.isArray((output as any).images)) {
            imageOutputs = output;
            console.log(`Found images in node ${nodeId}:`, (output as any).images.length);
            break;
          }
        }

        if (imageOutputs && imageOutputs.images.length > 0) {
          // Get image URLs
          const imageUrls = imageOutputs.images.map((img: any) => {
            const url = `${COMFYUI_URL}/view?filename=${encodeURIComponent(img.filename)}`;
            console.log('Generated image URL:', url);
            return url;
          });

          job.status = 'completed';
          job.progress = 100;
          job.resultUrls = imageUrls;
          jobs.set(jobId, job);
          console.log(`Job ${jobId} completed successfully with ${imageUrls.length} images`);
          
          // Log successful generation for analytics
          console.log(`User ${job.userId} successfully generated ${imageUrls.length} images using LoRA: ${job.usedLoRA}`);
        } else {
          console.error('No images found in outputs');
          job.status = 'failed';
          job.error = 'No images generated';
          jobs.set(jobId, job);
        }
      } else {
        console.error('Job not found in history');
        job.status = 'failed';
        job.error = 'Job not found in history';
        jobs.set(jobId, job);
      }

    } catch (error) {
      console.error('Error monitoring ComfyUI job:', error);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = `Monitoring error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        jobs.set(jobId, job);
      }
    }
  };

  // Start checking after 3 seconds
  setTimeout(checkStatus, 3000);
}

// GET endpoint to check job status (updated to include user validation)
export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { error: 'Missing jobId parameter' },
      { status: 400 }
    );
  }

  const job = jobs.get(jobId);
  
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }
  
  // Ensure user can only access their own jobs
  if (job.userId && job.userId !== userId) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  return NextResponse.json(job);
}

// Export the jobs Map so other endpoints can access it
export { jobs };