import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { RunPodTrainingClient } from '@/lib/runpodTrainingClient';
import { z } from 'zod';

// Function to parse training progress from RunPod log messages
function parseTrainingProgress(message: string) {
  // Match the RunPod training progress format: "test4:  7%|▋ | 7/100 [00:19<02:47, 1.80s/it, lr: 1.0e-04 loss: 4.501e-01]"
  const progressMatch = message.match(/(test\d+):\s*(\d+)%\|[^|]*\|\s*(\d+)\/(\d+)\s*\[([^\]]*)<([^\]]*),\s*([^\]]*)\]\s*(?:lr:\s*([\d.e-]+)\s*)?(?:loss:\s*([\d.e-]+))?/);
  
  if (progressMatch) {
    const [, jobName, progressPercent, currentStep, totalSteps, elapsed, eta, speed, learningRate, loss] = progressMatch;
    
    return {
      progress: parseInt(progressPercent, 10),
      currentStep: parseInt(currentStep, 10),
      totalSteps: parseInt(totalSteps, 10),
      loss: loss ? parseFloat(loss) : undefined,
      learningRate: learningRate ? parseFloat(learningRate) : undefined,
      eta: eta || undefined,
      elapsed: elapsed || undefined,
      speed: speed || undefined,
      message: message.trim()
    };
  }

  // Also check for other training status messages
  if (message.includes('Loading') || message.includes('Quantizing') || message.includes('Preparing')) {
    return {
      progress: 0,
      currentStep: 0,
      totalSteps: 100,
      message: message.trim()
    };
  }

  return null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const params = await context.params;
    const jobId = params.jobId;
    console.log(`🎣 Received training webhook for job ${jobId}`);

    // Parse the webhook payload
    const body = await request.json();
    console.log('📊 Webhook payload:', JSON.stringify(body, null, 2));

    // Handle different payload structures
    let runPodJobId: string;
    let runPodStatus: string;
    let output: any;
    let error: string | undefined;

    // Check if this is a direct RunPod webhook or our custom format
    if (body.id && ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(body.status)) {
      // This is a RunPod webhook format
      runPodJobId = body.id;
      runPodStatus = body.status;
      output = body.output;
      error = body.error;
      console.log('🏃 Processing RunPod webhook format');
    } else if (body.job_id && body.status) {
      // This is our custom webhook format
      runPodJobId = body.runpod_job_id || body.job_id;
      runPodStatus = body.status;
      output = body.output;
      error = body.error;
      console.log('🔧 Processing custom webhook format');
    } else {
      console.error('❌ Unknown webhook payload format');
      return NextResponse.json(
        { error: 'Invalid webhook payload format' },
        { status: 400 }
      );
    }

    // Try to find the training job - first by our job ID, then by RunPod job ID
    let trainingJob = await TrainingJobsDB.getTrainingJobById(jobId);
    
    if (!trainingJob) {
      // Try to find by RunPod job ID
      trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(runPodJobId);
    }
    
    if (!trainingJob) {
      console.error(`❌ Training job not found for job ID: ${jobId} or RunPod ID: ${runPodJobId}`);
      return NextResponse.json(
        { error: 'Training job not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

    // Map RunPod status to our status
    const status = RunPodTrainingClient.mapRunPodStatus(runPodStatus);
    console.log(`🔄 Status mapping: ${runPodStatus} -> ${status}`);

    // Prepare updates
    const updates: any = {
      status,
      error,
    };

    // Handle completion with automatic LoRA creation
    if (runPodStatus === 'COMPLETED') {
      updates.completedAt = new Date();
      updates.progress = 100;

      // Process the output if available
      if (output) {
        // Extract URLs from the output
        if (output.final_model_url) {
          updates.finalModelUrl = output.final_model_url;
        }
        if (output.checkpoint_urls) {
          updates.checkpointUrls = Array.isArray(output.checkpoint_urls) 
            ? output.checkpoint_urls 
            : [output.checkpoint_urls];
        }
        if (output.sample_urls) {
          updates.sampleUrls = Array.isArray(output.sample_urls)
            ? output.sample_urls
            : [output.sample_urls];
        }
        if (output.log_url) {
          updates.logUrl = output.log_url;
        }

        console.log('📥 Processing training completion output:', {
          finalModelUrl: updates.finalModelUrl,
          checkpointCount: updates.checkpointUrls?.length || 0,
          sampleCount: updates.sampleUrls?.length || 0,
          hasLogUrl: !!updates.logUrl
        });

        // Auto-create LoRA record if we have a final model or network volume path
        if (updates.finalModelUrl || output.network_volume_path || output.comfyui_path) {
          try {
            console.log('🎯 Creating LoRA record for completed training...');
            
            // Check if LoRA record was already created during training
            if (output.lora_record_created) {
              console.log('✅ LoRA record already created during training process');
              updates.resultingLoRACreated = true;
            } else {
              // Create LoRA record if not already created
              const loraData = {
                name: `${trainingJob.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_lora`,
                displayName: `${trainingJob.name} LoRA`,
                fileName: output.unique_filename || `${trainingJob.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_lora.safetensors`,
                originalFileName: output.model_file || `${trainingJob.name} LoRA.safetensors`,
                fileSize: output.model_size || 0,
                description: trainingJob.description || `LoRA model trained from ${trainingJob.name}`,
                cloudinaryUrl: updates.finalModelUrl,
                cloudinaryPublicId: '', // Will be set when uploaded to Cloudinary
                comfyUIPath: output.comfyui_path,
                isActive: true,
                trainingJobId: trainingJob.id,
                syncStatus: output.network_volume_path ? 'SYNCED' as const : 'PENDING' as const,
              };

              console.log('📝 LoRA data prepared:', loraData);

              // Create the LoRA record
              const loraCreated = await TrainingJobsDB.createLoRAFromTrainingJob(
                trainingJob.id,
                loraData
              );

              if (loraCreated) {
                console.log('✅ LoRA record created successfully');
                updates.resultingLoRACreated = true;
              } else {
                console.log('⚠️ LoRA record creation failed');
              }
            }
          } catch (loraError) {
            console.error('❌ Failed to create LoRA record:', loraError);
            // Don't fail the webhook - just log the error
          }
        }
      }
    } else if (runPodStatus === 'FAILED') {
      updates.completedAt = new Date();
    } else if (runPodStatus === 'IN_PROGRESS') {
      // Handle progress updates from structured output
      if (output && output.progress) {
        updates.progress = Math.round(output.progress * 100);
        updates.currentStep = output.current_step || updates.currentStep;
        updates.totalSteps = output.total_steps || updates.totalSteps;
        updates.loss = output.loss;
        updates.learningRate = output.learning_rate;
        updates.eta = output.eta;
      }

      // Parse progress from message field (RunPod training logs)
      if (body.message && typeof body.message === 'string') {
        const progressData = parseTrainingProgress(body.message);
        if (progressData) {
          updates.progress = progressData.progress;
          updates.currentStep = progressData.currentStep;
          updates.totalSteps = progressData.totalSteps;
          updates.loss = progressData.loss;
          updates.learningRate = progressData.learningRate;
          updates.eta = progressData.eta;
          
          console.log('📈 Parsed training progress:', progressData);
        } else {
          // Store the message even if we can't parse structured progress
          console.log('📝 Training status message:', body.message);
        }
      }

      // Handle sample images during training
      if (output && output.sample_images) {
        const sampleUrls = Array.isArray(output.sample_images) 
          ? output.sample_images 
          : [output.sample_images];
        updates.sampleUrls = [...(trainingJob.sampleUrls || []), ...sampleUrls];
      }
    }

    // Update the training job
    console.log('💾 Updating training job with:', updates);
    await TrainingJobsDB.updateTrainingJob(trainingJob.id, updates);

    console.log(`✅ Training job ${trainingJob.id} updated successfully`);

    return NextResponse.json({
      success: true,
      jobId: trainingJob.id,
      status: updates.status,
      message: 'Webhook processed successfully',
      updates: Object.keys(updates)
    });

  } catch (error) {
    console.error('❌ Training webhook error:', error);
    
    // Return error but with 200 status so RunPod doesn't keep retrying
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Webhook processing failed',
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'training webhook',
    timestamp: new Date().toISOString(),
    message: 'Training webhook endpoint is active',
  });
}

// Handle CORS for webhook testing
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
