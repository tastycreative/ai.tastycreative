import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('📦 Received model upload to database');

    const { 
      jobId, 
      modelName, 
      fileName,
      fileData, // base64 encoded file data
      trainingSteps,
      finalLoss 
    } = await request.json();

    if (!fileData || !jobId || !modelName || !fileName) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: fileData, jobId, modelName, fileName' 
      }, { status: 400 });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');
    console.log(`📦 Model file size: ${buffer.length} bytes (${Math.round(buffer.length / 1024 / 1024)}MB)`);

    // Find the training job to get the user ID
    let trainingJob = await TrainingJobsDB.getTrainingJob(jobId, '');
    
    if (!trainingJob) {
      // Try to find by RunPod job ID
      trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(jobId);
    }
    
    if (!trainingJob) {
      console.error(`❌ Training job not found for ID: ${jobId}`);
      return NextResponse.json({ 
        error: 'Training job not found' 
      }, { status: 404 });
    }

    console.log(`✅ Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

    // Validate file type
    if (!fileName.endsWith('.safetensors')) {
      console.error('❌ Invalid file type');
      return NextResponse.json({ 
        error: 'Only .safetensors files are allowed' 
      }, { status: 400 });
    }

    try {
      // Check if LoRA entry already exists
      let lora = await prisma.influencerLoRA.findFirst({
        where: {
          clerkId: trainingJob.clerkId,
          trainingJobId: trainingJob.id
        }
      });

      if (lora) {
        // Update existing LoRA with model data
        lora = await prisma.influencerLoRA.update({
          where: { id: lora.id },
          data: {
            fileName: fileName,
            fileSize: buffer.length,
            data: buffer,  // Store binary data directly in database
            syncStatus: 'SYNCED',
            isActive: true,
            updatedAt: new Date()
          }
        });
        console.log(`✅ Updated existing LoRA: ${lora.id} with model data`);
      } else {
        // Create new LoRA entry with model data
        lora = await prisma.influencerLoRA.create({
          data: {
            clerkId: trainingJob.clerkId,
            name: modelName,
            displayName: trainingJob.description || trainingJob.name || modelName,
            fileName: fileName,
            originalFileName: fileName,
            fileSize: buffer.length,
            data: buffer,  // Store binary data directly in database
            description: `LoRA trained from ${modelName} - ${trainingSteps} steps${finalLoss ? `, final loss: ${finalLoss}` : ''}`,
            trainingJobId: trainingJob.id,
            syncStatus: 'SYNCED',
            isActive: true
          }
        });
        console.log(`✅ Created new LoRA: ${lora.id} with model data stored in database`);
      }

      // Update training job with completion details
      await TrainingJobsDB.updateTrainingJob(trainingJob.id, {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        ...(finalLoss && { loss: parseFloat(finalLoss) })
      });

      await prisma.$disconnect();

      console.log('🎉 Model uploaded to database and LoRA created successfully!');

      return NextResponse.json({
        success: true,
        message: 'Model uploaded to database and LoRA created successfully',
        lora: {
          id: lora.id,
          name: lora.name,
          fileName: lora.fileName,
          fileSize: lora.fileSize,
          isActive: lora.isActive
        },
        storedInDatabase: true
      });

    } finally {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error('❌ Prisma disconnect error:', disconnectError);
      }
    }

  } catch (error) {
    console.error('💥 Database upload error:', error);

    return NextResponse.json({
      error: 'Failed to upload model to database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Database upload endpoint is active',
    timestamp: new Date().toISOString()
  });
}
