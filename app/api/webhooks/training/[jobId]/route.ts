import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { RunPodTrainingClient } from '@/lib/runpodTrainingClient';
import { z } from 'zod';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const params = await context.params;
    const jobId = params.jobId;
    console.log(`🔔 Received training webhook for job ${jobId}`);

    // Parse the webhook payload
    const body = await request.json();
    console.log('📦 Webhook payload:', JSON.stringify(body, null, 2));

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
      console.log('📡 Processing RunPod webhook format');
    } else if (body.job_id && body.status) {
      // This is our custom webhook format
      runPodJobId = body.runpod_job_id || body.job_id;
      runPodStatus = body.status;
      output = body.output;
      error = body.error;
      console.log('📡 Processing custom webhook format');
    } else {
      console.error('❌ Unknown webhook payload format');
      return NextResponse.json(
        { error: 'Invalid webhook payload format' },
        { status: 400 }
      );
    }

    // Try to find the training job - first by our job ID, then by RunPod job ID
    let trainingJob = await TrainingJobsDB.getTrainingJob(jobId, '');
    
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

    console.log(`📋 Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

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
        
        // Extract training metrics
        if (output.final_loss) {
          updates.loss = output.final_loss;
        }
        if (output.final_learning_rate) {
          updates.learningRate = output.final_learning_rate;
        }

        console.log('✅ Extracted completion data:', {
          finalModelUrl: updates.finalModelUrl,
          checkpointCount: updates.checkpointUrls?.length || 0,
          sampleCount: updates.sampleUrls?.length || 0,
          finalLoss: updates.loss
        });
      }

      // ✨ AUTOMATIC LORA CREATION - This is the key fix!
      try {
        console.log('🎯 Attempting to create LoRA entry automatically...');
        
        // Check if LoRA already exists
        const { PrismaClient } = require('@/lib/generated/prisma');
        const prisma = new PrismaClient();
        
        const existingLora = await prisma.influencerLoRA.findFirst({
          where: {
            clerkId: trainingJob.clerkId,
            trainingJobId: trainingJob.id
          }
        });

        if (existingLora) {
          console.log('✅ LoRA already exists:', existingLora.id);
          
          // Update existing LoRA to active status
          await prisma.influencerLoRA.update({
            where: { id: existingLora.id },
            data: {
              isActive: true,
              syncStatus: 'SYNCED',
              updatedAt: new Date()
            }
          });
        } else {
          console.log('🆕 Creating new LoRA entry...');
          
          // Create new LoRA entry
          const newLora = await prisma.influencerLoRA.create({
            data: {
              clerkId: trainingJob.clerkId,
              name: trainingJob.name,
              displayName: trainingJob.description || trainingJob.name,
              fileName: `${trainingJob.name}.safetensors`,
              originalFileName: `${trainingJob.name}_trained.safetensors`,
              fileSize: 0, // Will be updated when file is actually available
              description: `LoRA trained from ${trainingJob.name} - automatically created from training completion`,
              trainingJobId: trainingJob.id,
              syncStatus: 'SYNCED', // Mark as synced since training completed
              isActive: true, // Activate immediately
              thumbnailUrl: output?.sample_urls?.[0] || null
            }
          });

          console.log('✅ Created LoRA entry automatically:', {
            id: newLora.id,
            name: newLora.name,
            fileName: newLora.fileName
          });
        }

        await prisma.$disconnect();
        
      } catch (loraError) {
        console.error('❌ Failed to create LoRA entry:', loraError);
        // Don't fail the webhook - just log the error
      }
    }

    // Handle progress updates for active jobs
    else if (runPodStatus === 'IN_PROGRESS' && output) {
      if (output.current_step) {
        updates.currentStep = output.current_step;
      }
      if (output.progress_percentage) {
        updates.progress = Math.min(100, Math.max(0, output.progress_percentage));
      }
      if (output.loss) {
        updates.loss = output.loss;
      }
      if (output.learning_rate) {
        updates.learningRate = output.learning_rate;
      }
      if (output.eta) {
        updates.eta = output.eta;
      }
      if (output.sample_images) {
        updates.sampleUrls = Array.isArray(output.sample_images)
          ? output.sample_images
          : [output.sample_images];
      }
      if (output.checkpoint_url) {
        updates.checkpointUrls = [output.checkpoint_url];
      }

      console.log('📈 Progress update:', {
        currentStep: updates.currentStep,
        progress: updates.progress,
        loss: updates.loss,
        eta: updates.eta
      });
    }

    // Handle failures
    else if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(runPodStatus)) {
      updates.completedAt = new Date();
      if (error) {
        updates.error = error;
      }
      console.log('❌ Job failed/cancelled:', error);
    }

    // Handle queued/starting states
    else if (runPodStatus === 'IN_QUEUE') {
      if (!trainingJob.startedAt) {
        updates.startedAt = new Date();
      }
      console.log('🚀 Job queued/started');
    }

    // Update the training job
    await TrainingJobsDB.updateTrainingJob(trainingJob.id, updates);

    console.log(`✅ Updated training job ${trainingJob.id} with status ${status}`);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      jobId: trainingJob.id,
      status: status,
      loraCreated: runPodStatus === 'COMPLETED'
    });

  } catch (error) {
    console.error('💥 Training webhook error:', error);

    // Log validation errors specifically
    if (error instanceof z.ZodError) {
      console.error('📋 Validation errors:', error.issues);
      return NextResponse.json(
        { 
          error: 'Invalid webhook payload',
          details: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const params = await context.params;
  return NextResponse.json({
    message: 'Training webhook endpoint is active',
    jobId: params.jobId,
    timestamp: new Date().toISOString()
  });
}
