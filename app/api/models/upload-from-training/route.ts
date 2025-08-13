import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { PrismaClient } from '@/lib/generated/prisma';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('📦 Received model upload from training completion');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobId = formData.get('job_id') as string;
    const modelName = formData.get('model_name') as string;
    const trainingSteps = formData.get('training_steps') as string;
    const finalLoss = formData.get('final_loss') as string;

    if (!file || !jobId || !modelName) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: file, job_id, model_name' 
      }, { status: 400 });
    }

    console.log('📋 Upload details:', {
      fileName: file.name,
      fileSize: file.size,
      jobId,
      modelName,
      trainingSteps,
      finalLoss
    });

    // Find the training job to get the user ID
    const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(jobId);
    
    if (!trainingJob) {
      console.error(`❌ Training job not found for ID: ${jobId}`);
      return NextResponse.json({ 
        error: 'Training job not found' 
      }, { status: 404 });
    }

    console.log(`✅ Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

    // Validate file type
    if (!file.name.endsWith('.safetensors')) {
      console.error('❌ Invalid file type');
      return NextResponse.json({ 
        error: 'Only .safetensors files are allowed' 
      }, { status: 400 });
    }

    // Create models directory structure
    const modelsDir = path.join(process.cwd(), 'public', 'models');
    const userModelsDir = path.join(modelsDir, trainingJob.clerkId);
    
    await fs.mkdir(modelsDir, { recursive: true });
    await fs.mkdir(userModelsDir, { recursive: true });

    // Save file with proper name
    const fileName = `${modelName}.safetensors`;
    const filePath = path.join(userModelsDir, fileName);
    
    const buffer = await file.arrayBuffer();
    await fs.writeFile(filePath, new Uint8Array(buffer));

    console.log(`✅ Model file saved: ${fileName} (${file.size} bytes)`);

    // Check if LoRA entry already exists
    let lora = await prisma.influencerLoRA.findFirst({
      where: {
        clerkId: trainingJob.clerkId,
        trainingJobId: trainingJob.id
      }
    });

    if (lora) {
      // Update existing LoRA
      lora = await prisma.influencerLoRA.update({
        where: { id: lora.id },
        data: {
          fileName: fileName,
          fileSize: file.size,
          syncStatus: 'SYNCED',
          isActive: true,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Updated existing LoRA: ${lora.id}`);
    } else {
      // Create new LoRA entry
      lora = await prisma.influencerLoRA.create({
        data: {
          clerkId: trainingJob.clerkId,
          name: modelName,
          displayName: trainingJob.description || trainingJob.name || modelName,
          fileName: fileName,
          originalFileName: file.name,
          fileSize: file.size,
          description: `LoRA trained from ${modelName} - ${trainingSteps} steps${finalLoss ? `, final loss: ${finalLoss}` : ''}`,
          trainingJobId: trainingJob.id,
          syncStatus: 'SYNCED',
          isActive: true
        }
      });
      console.log(`✅ Created new LoRA: ${lora.id}`);
    }

    // Update training job with completion details
    await TrainingJobsDB.updateTrainingJob(trainingJob.id, {
      status: 'COMPLETED',
      progress: 100,
      completedAt: new Date(),
      finalModelUrl: `/models/${trainingJob.clerkId}/${fileName}`,
      ...(finalLoss && { loss: parseFloat(finalLoss) })
    });

    await prisma.$disconnect();

    console.log('🎉 Model upload and LoRA creation completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Model uploaded and LoRA created successfully',
      lora: {
        id: lora.id,
        name: lora.name,
        fileName: lora.fileName,
        fileSize: lora.fileSize,
        isActive: lora.isActive
      },
      filePath: `/models/${trainingJob.clerkId}/${fileName}`
    });

  } catch (error) {
    console.error('💥 Model upload error:', error);
    
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('❌ Prisma disconnect error:', disconnectError);
    }

    return NextResponse.json({
      error: 'Failed to upload model',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Model upload endpoint is active',
    timestamp: new Date().toISOString()
  });
}
