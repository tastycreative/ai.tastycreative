import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { auth } from '@clerk/nextjs/server';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Create LoRA from training endpoint called');

    // Check authentication via header for training jobs
    const authHeader = request.headers.get('Authorization');
    const expectedKey = process.env.TRAINING_UPLOAD_KEY;
    
    if (!authHeader || !expectedKey || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const providedKey = authHeader.replace('Bearer ', '');
    if (providedKey !== expectedKey) {
      console.log('❌ Invalid training upload key');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log('📊 Request body:', body);

    const {
      name,
      displayName,
      fileName,
      originalFileName,
      fileSize,
      description,
      comfyUIPath,
      syncStatus = 'SYNCED',
      isActive = true,
      trainingJobId,
      clerkId
    } = body;

    // Validate required fields
    if (!name || !displayName || !fileName || !originalFileName) {
      return NextResponse.json(
        { error: 'Missing required fields: name, displayName, fileName, originalFileName' },
        { status: 400 }
      );
    }

    // If clerkId is not provided, try to get it from the training job
    let userClerkId = clerkId;
    if (!userClerkId && trainingJobId) {
      try {
        const trainingJob = await prisma.trainingJob.findUnique({
          where: { id: trainingJobId },
          select: { clerkId: true }
        });
        
        if (trainingJob) {
          userClerkId = trainingJob.clerkId;
          console.log(`📋 Found clerkId from training job: ${userClerkId}`);
        }
      } catch (error) {
        console.log('⚠️ Could not find training job, proceeding without clerkId link');
      }
    }

    if (!userClerkId) {
      return NextResponse.json(
        { error: 'Could not determine user ID - provide clerkId or valid trainingJobId' },
        { status: 400 }
      );
    }

    try {
      // Create the LoRA record
      const loraRecord = await prisma.influencerLoRA.create({
        data: {
          clerkId: userClerkId,
          name,
          displayName,
          fileName,
          originalFileName,
          fileSize: fileSize || 0,
          description,
          comfyUIPath,
          syncStatus: syncStatus.toUpperCase() as any,
          isActive,
          trainingJobId,
          uploadedAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('✅ LoRA record created successfully:', loraRecord.id);

      return NextResponse.json({
        success: true,
        lora: {
          id: loraRecord.id,
          name: loraRecord.name,
          displayName: loraRecord.displayName,
          fileName: loraRecord.fileName,
          comfyUIPath: loraRecord.comfyUIPath,
          syncStatus: loraRecord.syncStatus,
          createdAt: loraRecord.uploadedAt
        }
      });

    } catch (dbError) {
      console.error('❌ Database error creating LoRA record:', dbError);
      
      // Check if it's a unique constraint violation
      if (dbError instanceof Error && dbError.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A LoRA with this filename already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create LoRA record in database' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error in create-from-training endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}