// app/api/models/upload-from-training/create-record/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('💾 Received database record creation request from training');

    const body = await request.json();
    console.log('📋 Database record data:', body);

    const {
      job_id,
      model_name,
      file_name,
      original_file_name,
      file_size,
      cloudinary_url,
      cloudinary_public_id,
      training_steps,
      final_loss
    } = body;

    if (!job_id || !model_name || !file_name || !file_size || !cloudinary_url) {
      return NextResponse.json({ 
        error: 'Missing required fields: job_id, model_name, file_name, file_size, cloudinary_url' 
      }, { status: 400 });
    }

    console.log(`🔍 Looking for training job with RunPod ID: ${job_id}`);

    // Find the training job
    const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(job_id);
    
    if (!trainingJob) {
      throw new Error(`Training job not found for ID: ${job_id}`);
    }

    console.log(`✅ Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

    // Validate file type
    if (!file_name.endsWith('.safetensors')) {
      throw new Error('Only .safetensors files are allowed');
    }

    // Check if LoRA entry already exists
    let lora = await prisma.influencerLoRA.findFirst({
      where: {
        clerkId: trainingJob.clerkId,
        trainingJobId: trainingJob.id
      }
    });

    const displayName = trainingJob.description || trainingJob.name || model_name;
    const description = `LoRA trained from ${model_name}${training_steps ? ` - ${training_steps} steps` : ''}${final_loss ? `, final loss: ${final_loss}` : ''}`;

    if (lora) {
      // Update existing LoRA
      lora = await prisma.influencerLoRA.update({
        where: { id: lora.id },
        data: {
          fileName: file_name,
          fileSize: parseInt(file_size.toString()),
          cloudinaryUrl: cloudinary_url,
          cloudinaryPublicId: cloudinary_public_id,
          description: description,
          syncStatus: 'PENDING', // Will need to sync to ComfyUI
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
          name: model_name,
          displayName: displayName,
          fileName: file_name,
          originalFileName: original_file_name || file_name,
          fileSize: parseInt(file_size.toString()),
          description: description,
          cloudinaryUrl: cloudinary_url,
          cloudinaryPublicId: cloudinary_public_id,
          trainingJobId: trainingJob.id,
          syncStatus: 'PENDING', // Will need to sync to ComfyUI
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
      finalModelUrl: cloudinary_url,
      ...(final_loss && { loss: parseFloat(final_loss) })
    });

    await prisma.$disconnect();

    console.log('🎉 Database record created successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database record created successfully',
      lora: {
        id: lora.id,
        name: lora.name,
        fileName: lora.fileName,
        fileSize: lora.fileSize,
        isActive: lora.isActive,
        cloudinaryUrl: cloudinary_url
      }
    });

  } catch (error) {
    console.error('💥 Database record creation error:', error);
    
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('❌ Prisma disconnect error:', disconnectError);
    }

    return NextResponse.json({
      error: 'Failed to create database record',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Database record creation endpoint is active',
    timestamp: new Date().toISOString(),
    supportedMethods: ['POST']
  });
}
