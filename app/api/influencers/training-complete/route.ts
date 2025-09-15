import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Training completion endpoint called');
    
    // Check for training upload key
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.TRAINING_UPLOAD_KEY;
    
    // Enhanced debugging
    console.log('🔍 Debug info:');
    console.log('  - Authorization header present:', !!authHeader);
    console.log('  - Expected key present:', !!expectedKey);
    console.log('  - Expected key length:', expectedKey?.length || 0);
    console.log('  - Auth header value (first 20 chars):', authHeader?.substring(0, 20) || 'none');
    
    if (!authHeader || !expectedKey) {
      console.log('❌ Missing authorization header or key');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    console.log('  - Token length:', token.length);
    console.log('  - Token matches expected:', token === expectedKey);
    
    if (token !== expectedKey) {
      console.log('❌ Invalid training upload key');
      console.log('  - Token (first 20 chars):', token.substring(0, 20));
      console.log('  - Expected (first 20 chars):', expectedKey.substring(0, 20));
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('📊 Training completion data received:', body);

    // Validate required fields
    const requiredFields = ['name', 'fileName', 'comfyUIPath', 'trainingJobId'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Extract clerkId - try from body first, then lookup by trainingJobId
    let clerkId = body.clerkId;
    
    if (!clerkId && body.trainingJobId) {
      console.log('🔍 Looking up clerkId from trainingJobId:', body.trainingJobId);
      
      // Try to find user from existing records using trainingJobId pattern
      // RunPod job IDs often contain user information or can be looked up
      try {
        // First check if there's already a training job record
        const existingJob = await prisma.trainingJob.findUnique({
          where: { id: body.trainingJobId },
          select: { clerkId: true }
        });
        
        if (existingJob?.clerkId) {
          clerkId = existingJob.clerkId;
          console.log('✅ Found clerkId from TrainingJob:', clerkId);
        }
      } catch (lookupError) {
        console.log('⚠️ Could not lookup trainingJob:', lookupError);
      }
    }

    if (!clerkId) {
      console.log('⚠️ No clerkId available, using fallback');
      clerkId = 'system'; // Fallback for system-created models
    }

    try {
      // Create the LoRA record
      const loraRecord = await prisma.influencerLoRA.create({
        data: {
          clerkId: clerkId,
          name: body.name,
          displayName: body.displayName || body.name,
          fileName: body.fileName,
          originalFileName: body.originalFileName || body.fileName,
          fileSize: body.fileSize || 0,
          description: body.description || '',
          comfyUIPath: body.comfyUIPath,
          syncStatus: body.syncStatus || 'SYNCED',
          isActive: body.isActive !== false, // Default to true
          trainingJobId: body.trainingJobId
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
    console.error('❌ Unexpected error in training completion endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}