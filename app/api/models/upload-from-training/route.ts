// app/api/models/upload-from-training/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { PrismaClient } from '@/lib/generated/prisma';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (same as your image uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

// Store for chunked uploads (in-memory, could use Redis for production)
const chunkStore = new Map<string, {
  chunks: Map<number, Buffer>;
  totalChunks: number;
  metadata: {
    jobId: string;
    modelName: string;
    fileName: string;
    trainingSteps?: string;
    finalLoss?: string;
  };
  lastActivity: number;
}>();

// Clean up old chunk sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [sessionId, session] of chunkStore.entries()) {
    if (session.lastActivity < oneHourAgo) {
      chunkStore.delete(sessionId);
      console.log(`🧹 Cleaned up expired chunk session: ${sessionId}`);
    }
  }
}, 10 * 60 * 1000); // Clean every 10 minutes

export async function POST(request: NextRequest) {
  try {
    console.log('📦 Received upload request from training');

    // Check if this is a chunked upload or single file upload
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Single file upload (fallback method)
      return handleSingleFileUpload(request);
    } else {
      // Chunked upload (streaming upload from RunPod)
      return handleChunkedUpload(request);
    }

  } catch (error) {
    console.error('💥 Upload error:', error);
    
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('❌ Prisma disconnect error:', disconnectError);
    }

    return NextResponse.json({
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleChunkedUpload(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    console.log('📋 Chunked upload data:', body);

    const {
      session_id,
      chunk_index,
      total_chunks,
      chunk_data, // Base64 encoded chunk
      job_id,
      model_name,
      file_name,
      training_steps,
      final_loss,
      is_final_chunk
    } = body;

    if (!session_id || chunk_index === undefined || !chunk_data || !job_id) {
      return NextResponse.json({ 
        error: 'Missing required chunked upload fields' 
      }, { status: 400 });
    }

    console.log(`📤 Processing chunk ${chunk_index + 1}/${total_chunks} for session ${session_id}`);

    // Get or create chunk session
    let session = chunkStore.get(session_id);
    if (!session) {
      session = {
        chunks: new Map(),
        totalChunks: total_chunks,
        metadata: {
          jobId: job_id,
          modelName: model_name,
          fileName: file_name,
          trainingSteps: training_steps,
          finalLoss: final_loss
        },
        lastActivity: Date.now()
      };
      chunkStore.set(session_id, session);
      console.log(`🆕 Created new chunk session: ${session_id}`);
    }

    // Store chunk
    const chunkBuffer = Buffer.from(chunk_data, 'base64');
    session.chunks.set(chunk_index, chunkBuffer);
    session.lastActivity = Date.now();

    console.log(`✅ Stored chunk ${chunk_index + 1}/${total_chunks} (${chunkBuffer.length} bytes)`);

    // Check if all chunks received
    if (session.chunks.size === session.totalChunks) {
      console.log('🔄 All chunks received, assembling file...');
      
      // Assemble all chunks in order
      const chunks: Buffer[] = [];
      for (let i = 0; i < session.totalChunks; i++) {
        const chunk = session.chunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i}`);
        }
        chunks.push(chunk);
      }

      const completeFile = Buffer.concat(chunks);
      console.log(`✅ File assembled: ${completeFile.length} bytes`);

      // Process the complete file
      const result = await processCompleteModel(
        completeFile,
        session.metadata.jobId,
        session.metadata.modelName,
        session.metadata.fileName || `${session.metadata.modelName}.safetensors`,
        session.metadata.trainingSteps,
        session.metadata.finalLoss
      );

      // Clean up session
      chunkStore.delete(session_id);
      console.log(`🧹 Cleaned up session: ${session_id}`);

      return NextResponse.json(result);
    } else {
      // Still waiting for more chunks
      return NextResponse.json({
        success: true,
        message: `Chunk ${chunk_index + 1}/${total_chunks} received`,
        chunks_received: session.chunks.size,
        total_chunks: session.totalChunks
      });
    }

  } catch (error) {
    console.error('❌ Chunked upload error:', error);
    throw error;
  }
}

async function handleSingleFileUpload(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobId = formData.get('job_id') as string;
    const modelName = formData.get('model_name') as string;
    const trainingSteps = formData.get('training_steps') as string;
    const finalLoss = formData.get('final_loss') as string;

    if (!file || !jobId || !modelName) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, job_id, model_name' 
      }, { status: 400 });
    }

    console.log('📋 Single file upload:', {
      fileName: file.name,
      fileSize: file.size,
      jobId,
      modelName
    });

    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    return await processCompleteModel(
      fileBuffer,
      jobId,
      modelName,
      file.name,
      trainingSteps,
      finalLoss
    );

  } catch (error) {
    console.error('❌ Single file upload error:', error);
    throw error;
  }
}

async function processCompleteModel(
  fileBuffer: Buffer,
  jobId: string,
  modelName: string,
  fileName: string,
  trainingSteps?: string,
  finalLoss?: string
): Promise<any> {
  try {
    console.log(`🔄 Processing complete model: ${fileName} (${fileBuffer.length} bytes)`);

    // Find the training job
    const trainingJob = await TrainingJobsDB.getTrainingJobByRunPodId(jobId);
    
    if (!trainingJob) {
      throw new Error(`Training job not found for ID: ${jobId}`);
    }

    console.log(`✅ Found training job: ${trainingJob.id} for user ${trainingJob.clerkId}`);

    // Validate file type
    if (!fileName.endsWith('.safetensors')) {
      throw new Error('Only .safetensors files are allowed');
    }

    // Upload to Cloudinary instead of Vercel Blob
    console.log('☁️ Uploading to Cloudinary...');
    
    const cloudinaryResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw', // For binary files like .safetensors
          public_id: `${modelName}_${Date.now()}`,
          folder: `lora-models/${trainingJob.clerkId}`,
          format: 'safetensors'
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload successful');
            resolve(result);
          }
        }
      ).end(fileBuffer);
    });

    console.log(`📂 Cloudinary URL: ${cloudinaryResult.secure_url}`);

    // Check if LoRA entry already exists
    let lora = await prisma.influencerLoRA.findFirst({
      where: {
        clerkId: trainingJob.clerkId,
        trainingJobId: trainingJob.id
      }
    });

    const displayName = trainingJob.description || trainingJob.name || modelName;
    const description = `LoRA trained from ${modelName}${trainingSteps ? ` - ${trainingSteps} steps` : ''}${finalLoss ? `, final loss: ${finalLoss}` : ''}`;

    if (lora) {
      // Update existing LoRA
      lora = await prisma.influencerLoRA.update({
        where: { id: lora.id },
        data: {
          fileName: fileName,
          fileSize: fileBuffer.length,
          cloudinaryUrl: cloudinaryResult.secure_url,
          cloudinaryPublicId: cloudinaryResult.public_id,
          description: description,
          syncStatus: 'pending', // Will need to sync to ComfyUI
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
          displayName: displayName,
          fileName: fileName,
          originalFileName: fileName,
          fileSize: fileBuffer.length,
          description: description,
          cloudinaryUrl: cloudinaryResult.secure_url,
          cloudinaryPublicId: cloudinaryResult.public_id,
          trainingJobId: trainingJob.id,
          syncStatus: 'pending', // Will need to sync to ComfyUI
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
      finalModelUrl: cloudinaryResult.secure_url,
      ...(finalLoss && { loss: parseFloat(finalLoss) })
    });

    await prisma.$disconnect();

    console.log('🎉 Model upload and LoRA creation completed successfully!');

    return {
      success: true,
      message: 'Model uploaded and LoRA created successfully',
      lora: {
        id: lora.id,
        name: lora.name,
        fileName: lora.fileName,
        fileSize: lora.fileSize,
        isActive: lora.isActive,
        cloudinaryUrl: cloudinaryResult.secure_url
      },
      cloudinaryUrl: cloudinaryResult.secure_url
    };

  } catch (error) {
    console.error('❌ Process complete model error:', error);
    throw error;
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Model upload endpoint is active',
    timestamp: new Date().toISOString(),
    supportedMethods: ['POST'],
    chunkSessions: chunkStore.size
  });
}