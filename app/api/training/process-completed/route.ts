import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { getUserId } from '@/lib/database';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runpodJobId, modelName = 'aiai' } = await request.json();

    console.log(`🔍 Processing completed training for RunPod job: ${runpodJobId}`);
    console.log(`👤 User: ${userId}`);

    if (!runpodJobId) {
      return NextResponse.json({ 
        error: 'Missing runpodJobId' 
      }, { status: 400 });
    }

    // Find the training job by RunPod job ID
    const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(runpodJobId);
    
    if (!trainingJob) {
      console.log(`❌ Training job not found for RunPod ID: ${runpodJobId}`);
      return NextResponse.json({ 
        error: 'Training job not found' 
      }, { status: 404 });
    }

    if (trainingJob.clerkId !== userId) {
      console.log(`❌ Unauthorized: Job ${trainingJob.id} belongs to user ${trainingJob.clerkId}, not ${userId}`);
      return NextResponse.json({ 
        error: 'Unauthorized access to training job' 
      }, { status: 403 });
    }

    console.log(`✅ Found training job: ${trainingJob.id} (${trainingJob.name})`);

    // Update training job as completed (if not already)
    if (trainingJob.status !== 'COMPLETED') {
      await TrainingJobsDB.updateTrainingJob(trainingJob.id, {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date()
      });
      console.log(`✅ Updated training job status to COMPLETED`);
    }

    // Check if LoRA already exists
    const existingLora = await prisma.influencerLoRA.findFirst({
      where: {
        clerkId: userId,
        name: modelName
      }
    });

    if (existingLora) {
      console.log(`⚠️ LoRA already exists: ${existingLora.id} (${existingLora.name})`);
      return NextResponse.json({
        success: true,
        message: 'LoRA already exists',
        loraId: existingLora.id,
        existing: true
      });
    }

    // Create the LoRA entry
    const loraFileName = `${modelName}.safetensors`;
    const displayName = trainingJob.description || trainingJob.name || modelName;
    
    const newLora = await prisma.influencerLoRA.create({
      data: {
        clerkId: userId,
        name: modelName,
        displayName: displayName,
        fileName: loraFileName,
        originalFileName: `${modelName}_lora.safetensors`,
        fileSize: 0, // Will need to be updated when we get the actual file
        description: `LoRA trained from ${trainingJob.name || 'training job'}`,
        trainingJobId: trainingJob.id,
        syncStatus: 'PENDING',
        isActive: false // Set to false until we upload the file
      }
    });

    console.log(`✅ Created LoRA entry: ${newLora.id} (${newLora.name})`);

    // Create a placeholder model file record in your system
    // This is where you'd normally download the file from RunPod
    // For now, we'll mark it as needing manual file upload

    return NextResponse.json({
      success: true,
      message: 'LoRA created successfully',
      lora: {
        id: newLora.id,
        name: newLora.name,
        displayName: newLora.displayName,
        fileName: newLora.fileName,
        trainingJobId: newLora.trainingJobId,
        status: 'pending_file_upload'
      },
      instructions: [
        '1. Download the aiai.safetensors file from your RunPod job',
        '2. Upload it to your LoRA models directory',
        '3. Update the file size and activate the LoRA',
        '4. The model will then be available for image generation'
      ]
    });

  } catch (error) {
    console.error('❌ Error processing completed training:', error);
    return NextResponse.json({
      error: 'Failed to process training job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check status
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const runpodJobId = url.searchParams.get('runpodJobId');

    if (runpodJobId) {
      // Check specific job status
      const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(runpodJobId);
      
      if (!trainingJob || trainingJob.clerkId !== userId) {
        return NextResponse.json({ 
          error: 'Training job not found' 
        }, { status: 404 });
      }

      // Check if LoRA exists
      const existingLora = await prisma.influencerLoRA.findFirst({
        where: {
          trainingJobId: trainingJob.id
        }
      });

      return NextResponse.json({
        trainingJob: {
          id: trainingJob.id,
          name: trainingJob.name,
          status: trainingJob.status,
          progress: trainingJob.progress,
          runpodJobId: trainingJob.runpodJobId
        },
        lora: existingLora ? {
          id: existingLora.id,
          name: existingLora.name,
          fileName: existingLora.fileName,
          syncStatus: existingLora.syncStatus,
          isActive: existingLora.isActive
        } : null
      });
    }

    // List all training jobs
    const trainingJobs = await TrainingJobsDB.getUserTrainingJobs(userId);
    
    return NextResponse.json({
      trainingJobs: trainingJobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        progress: job.progress,
        runpodJobId: job.runpodJobId,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching training status:', error);
    return NextResponse.json({
      error: 'Failed to fetch training status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
