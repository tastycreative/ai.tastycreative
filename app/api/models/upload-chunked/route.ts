import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { put } from '@vercel/blob';

// In-memory storage for chunked uploads (in production, use Redis or similar)
const uploadSessions = new Map();

export async function POST(request: NextRequest) {
  try {
    const { 
      jobId, 
      modelName, 
      fileName,
      chunkIndex,
      totalChunks,
      chunkData, // base64 encoded chunk
      sessionId
    } = await request.json();

    if (!chunkData || !jobId || !modelName || !fileName || chunkIndex === undefined || !totalChunks || !sessionId) {
      console.error('❌ Missing required fields for chunked upload');
      return NextResponse.json({ 
        error: 'Missing required fields: chunkData, jobId, modelName, fileName, chunkIndex, totalChunks, sessionId' 
      }, { status: 400 });
    }

    console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName} (session: ${sessionId})`);

    // Initialize session if it doesn't exist
    if (!uploadSessions.has(sessionId)) {
      uploadSessions.set(sessionId, {
        chunks: new Array(totalChunks).fill(null),
        metadata: { jobId, modelName, fileName },
        createdAt: Date.now()
      });
    }

    const session = uploadSessions.get(sessionId);
    
    // Store the chunk
    session.chunks[chunkIndex] = chunkData;
    
    // Check if we have all chunks
    const completedChunks = session.chunks.filter((chunk: string | null) => chunk !== null).length;
    console.log(`📊 Progress: ${completedChunks}/${totalChunks} chunks received`);

    if (completedChunks === totalChunks) {
      console.log('✅ All chunks received, assembling file...');
      
      try {
        // Combine all chunks
        const completeBase64 = session.chunks.join('');
        const buffer = Buffer.from(completeBase64, 'base64');
        console.log(`📦 Assembled complete file: ${buffer.length} bytes`);

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
                description: `LoRA trained from ${modelName}`,
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
            finalModelUrl: blob.url
          });

          await prisma.$disconnect();

          // Clean up session
          uploadSessions.delete(sessionId);

          console.log('🎉 Chunked upload and LoRA creation completed successfully!');

          return NextResponse.json({
            success: true,
            message: 'Model uploaded and LoRA created successfully via chunked upload',
            lora: {
              id: lora.id,
              name: lora.name,
              fileName: lora.fileName,
              fileSize: lora.fileSize,
              isActive: lora.isActive
            },
            filePath: blob.url,
            uploadComplete: true
          });

        } finally {
          try {
            await prisma.$disconnect();
          } catch (disconnectError) {
            console.error('❌ Prisma disconnect error:', disconnectError);
          }
        }

      } catch (assemblyError) {
        console.error('❌ Error assembling chunks:', assemblyError);
        uploadSessions.delete(sessionId);
        return NextResponse.json({
          error: 'Failed to assemble file chunks',
          details: assemblyError instanceof Error ? assemblyError.message : 'Unknown error'
        }, { status: 500 });
      }

    } else {
      // Not all chunks received yet
      return NextResponse.json({
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
        chunksReceived: completedChunks,
        totalChunks: totalChunks,
        uploadComplete: false
      });
    }

  } catch (error) {
    console.error('💥 Chunked upload error:', error);

    return NextResponse.json({
      error: 'Failed to process chunked upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Chunked upload endpoint is active',
    activeSessions: uploadSessions.size,
    timestamp: new Date().toISOString()
  });
}
