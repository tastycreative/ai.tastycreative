import { NextRequest, NextResponse } from 'next/server';
import { TrainingJobsDB } from '@/lib/trainingJobsDB';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// Store partial uploads in memory (for small files) or use a temporary approach
const uploadSessions = new Map<string, {
  chunks: Buffer[],
  totalSize: number,
  metadata: any,
  lastUpdate: number
}>();

// Clean up old sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 10 * 60 * 1000; // 10 minutes
  
  for (const [sessionId, session] of uploadSessions.entries()) {
    if (now - session.lastUpdate > timeout) {
      uploadSessions.delete(sessionId);
      console.log(`🧹 Cleaned up expired upload session: ${sessionId}`);
    }
  }
}, 10 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    console.log('📦 Received streaming upload request');

    // Simple API key auth to allow external (RunPod) access without Clerk session
    const apiKey = request.headers.get('x-api-key');
    const expected = process.env.TRAINING_UPLOAD_KEY;
    if (!expected) {
      console.warn('⚠️ TRAINING_UPLOAD_KEY not set in environment – refusing unauthenticated streaming upload');
      return NextResponse.json({ error: 'Server misconfiguration: training upload key missing' }, { status: 500 });
    }
    if (apiKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      sessionId,
      chunkIndex,
      totalChunks,
      chunkData, // base64 chunk
      isLastChunk,
      // Metadata sent with first chunk
      jobId,
      modelName,
      fileName,
      trainingSteps,
      finalLoss
    } = await request.json();

  if (!sessionId || chunkIndex === undefined || !chunkData) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, chunkIndex, chunkData' 
      }, { status: 400 });
    }

    console.log(`📤 Processing chunk ${chunkIndex + 1}/${totalChunks} for session ${sessionId}`);

    // Convert base64 chunk to buffer
    const chunkBuffer = Buffer.from(chunkData, 'base64');
    
    // Get or create session
    let session = uploadSessions.get(sessionId);
    if (!session) {
      if (!jobId || !modelName || !fileName) {
        return NextResponse.json({ 
          error: 'First chunk must include metadata: jobId, modelName, fileName' 
        }, { status: 400 });
      }
      
      session = {
        chunks: [],
        totalSize: 0,
        metadata: { jobId, modelName, fileName, trainingSteps, finalLoss },
        lastUpdate: Date.now()
      };
      uploadSessions.set(sessionId, session);
      console.log(`📝 Created new upload session: ${sessionId}`);
    }

    // Add chunk to session
    session.chunks[chunkIndex] = chunkBuffer;
    session.totalSize += chunkBuffer.length;
    session.lastUpdate = Date.now();

    console.log(`✅ Stored chunk ${chunkIndex + 1}/${totalChunks} (${chunkBuffer.length} bytes)`);

    // Check if upload is complete
    const receivedChunks = session.chunks.filter(chunk => chunk !== undefined).length;
    const isComplete = isLastChunk && receivedChunks === totalChunks;

    if (isComplete) {
      console.log(`🎯 All chunks received for session ${sessionId}, assembling file...`);
      
      try {
        // Combine all chunks into final buffer
        const finalBuffer = Buffer.concat(session.chunks);
        console.log(`📦 Final file size: ${finalBuffer.length} bytes (${Math.round(finalBuffer.length / 1024 / 1024)}MB)`);

        const { jobId, modelName, fileName, trainingSteps, finalLoss } = session.metadata;

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
          // Check if LoRA entry already exists (filter by clerkId first, then check trainingJobId)
          const existingLoras = await prisma.influencerLoRA.findMany({
            where: {
              clerkId: trainingJob.clerkId
            }
          });
          
          let lora = existingLoras.find((l: any) => l.trainingJobId === trainingJob.id);

          if (lora) {
            // Update existing LoRA with model data
            const updateData: any = {
              fileName: fileName,
              fileSize: finalBuffer.length,
              syncStatus: 'SYNCED',
              isActive: true,
              updatedAt: new Date()
            };
            // Only include binary field if supported in generated client
            if ('data' in (prisma.influencerLoRA as any)) {
              updateData.data = finalBuffer;
            }
            lora = await prisma.influencerLoRA.update({
              where: { id: lora.id },
              data: updateData
            });
            console.log(`✅ Updated existing LoRA: ${lora.id} with model data`);
          } else {
            // Create new LoRA entry with model data
            const createData: any = {
              clerkId: trainingJob.clerkId,
              name: modelName,
              displayName: trainingJob.description || trainingJob.name || modelName,
              fileName: fileName,
              originalFileName: fileName,
              fileSize: finalBuffer.length,
              description: `LoRA trained from ${modelName} - ${trainingSteps} steps${finalLoss ? `, final loss: ${finalLoss}` : ''}`,
              trainingJobId: trainingJob.id,
              syncStatus: 'SYNCED',
              isActive: true
            };
            if ('data' in (prisma.influencerLoRA as any)) {
              createData.data = finalBuffer;
            }
            lora = await prisma.influencerLoRA.create({ data: createData });
            console.log(`✅ Created new LoRA: ${lora.id} with model data stored in database`);
          }

          // Update training job with completion details
          await TrainingJobsDB.updateTrainingJob(trainingJob.id, {
            status: 'COMPLETED',
            progress: 100,
            completedAt: new Date(),
            ...(finalLoss && { loss: parseFloat(finalLoss) })
          });

          // Clean up session
          uploadSessions.delete(sessionId);
          console.log(`🧹 Cleaned up upload session: ${sessionId}`);

          console.log('🎉 Model uploaded to database and LoRA created successfully!');

          return NextResponse.json({
            success: true,
            uploadComplete: true,
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

      } catch (assemblyError) {
        console.error('💥 File assembly error:', assemblyError);
        uploadSessions.delete(sessionId);
        
        return NextResponse.json({
          error: 'Failed to assemble and store file',
          details: assemblyError instanceof Error ? assemblyError.message : 'Unknown error'
        }, { status: 500 });
      }

    } else {
      // Upload in progress
      return NextResponse.json({
        success: true,
        uploadComplete: false,
        chunkReceived: chunkIndex + 1,
        totalChunks: totalChunks,
        receivedChunks: receivedChunks,
        sessionId: sessionId
      });
    }

  } catch (error) {
    console.error('💥 Streaming upload error:', error);

    return NextResponse.json({
      error: 'Failed to process streaming upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const activeSessionsCount = uploadSessions.size;
  const sessionSummary = Array.from(uploadSessions.entries()).map(([id, session]) => ({
    sessionId: id,
    chunksReceived: session.chunks.filter(chunk => chunk !== undefined).length,
    totalSize: session.totalSize,
    lastUpdate: new Date(session.lastUpdate).toISOString(),
    metadata: session.metadata
  }));

  return NextResponse.json({
    message: 'Streaming upload endpoint is active',
    activeSessions: activeSessionsCount,
    sessions: sessionSummary,
    timestamp: new Date().toISOString()
  });
}
