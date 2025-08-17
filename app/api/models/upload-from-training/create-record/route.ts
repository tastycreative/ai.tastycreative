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
      comfyui_path,
      sync_status,
      training_steps,
      final_loss,
      user_id  // Add user_id parameter
    } = body;

    if (!job_id || !model_name || !file_name || !file_size) {
      return NextResponse.json({ 
        error: 'Missing required fields: job_id, model_name, file_name, file_size' 
      }, { status: 400 });
    }

    console.log(`🔍 Looking for training job with RunPod ID: ${job_id}`);

    // Find the training job
    const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(job_id);
    
    if (!trainingJob) {
      console.log(`⚠️ Training job not found for RunPod ID: ${job_id}`);
      console.log('🆘 Creating LoRA record without training job link (handler fallback)');
      
      // Create a direct LoRA record without training job reference
      // This is a fallback for when RunPod jobs aren't properly linked in database
      const lora = await prisma.influencerLoRA.create({
        data: {
          // Use the user_id from handler if provided, otherwise fallback
          clerkId: user_id || 'user_fallback', 
          name: model_name,
          displayName: model_name,
          fileName: file_name,
          originalFileName: original_file_name || file_name,
          fileSize: parseInt(file_size.toString()),
          description: `LoRA trained via RunPod${training_steps ? ` - ${training_steps} steps` : ''}${final_loss ? `, final loss: ${final_loss}` : ''}`,
          ...(cloudinary_url && { cloudinaryUrl: cloudinary_url }),
          ...(cloudinary_public_id && { cloudinaryPublicId: cloudinary_public_id }),
          ...(comfyui_path && { comfyUIPath: comfyui_path }),
          syncStatus: sync_status || 'synced', // Mark as synced since it's already uploaded
          isActive: true
        }
      });

      await prisma.$disconnect();

      console.log(`✅ Created fallback LoRA record: ${lora.id}`);

      return NextResponse.json({
        success: true,
        message: 'LoRA record created successfully (fallback mode)',
        lora: {
          id: lora.id,
          name: lora.name,
          fileName: lora.fileName,
          fileSize: lora.fileSize,
          isActive: lora.isActive,
          comfyUIPath: lora.comfyUIPath || undefined
        }
      });
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
          ...(cloudinary_url && { cloudinaryUrl: cloudinary_url }),
          ...(cloudinary_public_id && { cloudinaryPublicId: cloudinary_public_id }),
          ...(comfyui_path && { comfyUIPath: comfyui_path }),
          description: description,
          syncStatus: sync_status || 'PENDING',
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
          ...(cloudinary_url && { cloudinaryUrl: cloudinary_url }),
          ...(cloudinary_public_id && { cloudinaryPublicId: cloudinary_public_id }),
          ...(comfyui_path && { comfyUIPath: comfyui_path }),
          trainingJobId: trainingJob.id,
          syncStatus: sync_status || 'PENDING',
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
      finalModelUrl: cloudinary_url || comfyui_path || '',
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
        cloudinaryUrl: lora.cloudinaryUrl || undefined,
        comfyUIPath: lora.comfyUIPath || undefined
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
