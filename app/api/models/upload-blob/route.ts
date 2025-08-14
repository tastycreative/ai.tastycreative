import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    console.log('📦 Received direct blob upload from training completion');

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

    console.log('📋 Direct upload details:', {
      fileName,
      fileSize: Math.round(fileData.length * 0.75), // approximate size from base64
      jobId,
      modelName,
      trainingSteps,
      finalLoss
    });

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

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');
    console.log(`📦 Converted base64 to buffer: ${buffer.length} bytes`);

    // Save file to Vercel Blob storage
    const blobPath = `models/${trainingJob.clerkId}/${fileName}`;
    
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: 'application/octet-stream'
    });

    console.log(`✅ Model file uploaded to blob storage: ${fileName} (${buffer.length} bytes)`);
    console.log(`📂 Blob URL: ${blob.url}`);

    // Import Prisma client
    const { PrismaClient } = require('@/lib/generated/prisma');
    const prisma = new PrismaClient();

    try {
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
            fileSize: buffer.length,
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
            originalFileName: fileName,
            fileSize: buffer.length,
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
        finalModelUrl: blob.url,
        ...(finalLoss && { loss: parseFloat(finalLoss) })
      });

      await prisma.$disconnect();

      console.log('🎉 Direct blob upload and LoRA creation completed successfully!');

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
        filePath: blob.url
      });

    } finally {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error('❌ Prisma disconnect error:', disconnectError);
      }
    }

  } catch (error) {
    console.error('💥 Direct blob upload error:', error);

    return NextResponse.json({
      error: 'Failed to upload model directly to blob storage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Direct blob upload endpoint is active',
    timestamp: new Date().toISOString()
  });
}
