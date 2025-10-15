import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

// Validation schema for the image-to-image skin enhancer request
const ImageToImageSkinEnhancerSchema = z.object({
  workflow: z.record(z.any()),
  params: z.object({
    positivePrompt: z.string(),
    negativePrompt: z.string(),
    selectedModel: z.string(),
    selectedLoRA: z.string(),
    loraStrength: z.number(),
    steps: z.number(),
    cfg: z.number(),
    denoise: z.number(),
    seed: z.number(),
    originalImageName: z.string().optional(),
  }),
  user_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Image-to-Image Skin Enhancer API called');

    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate request data
    const validatedData = ImageToImageSkinEnhancerSchema.parse(body);
    
    console.log('✅ Request validated:', {
      userId,
      paramsKeys: Object.keys(validatedData.params),
      workflowNodeCount: Object.keys(validatedData.workflow).length,
    });

    // Get RunPod configuration
    const RUNPOD_API_URL = process.env.RUNPOD_IMAGE_TO_IMAGE_SKIN_ENHANCER_ENDPOINT_URL;
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

    if (!RUNPOD_API_URL || !RUNPOD_API_KEY) {
      console.error('❌ Missing RunPod image-to-image skin enhancer configuration:', {
        hasEndpointUrl: !!RUNPOD_API_URL,
        hasApiKey: !!RUNPOD_API_KEY,
      });
      return NextResponse.json(
        { error: 'RunPod image-to-image skin enhancer configuration missing' },
        { status: 500 }
      );
    }

    // Generate unique job ID
    const jobId = `img2img_skin_enhancer_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Prepare webhook URL for progress updates
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'https://ai.tastycreative.ai';
    const webhookUrl = `${baseUrl}/api/webhooks/generation/${jobId}`;

    console.log('🔗 Webhook URL:', webhookUrl);

    // Prepare RunPod payload
    const runpodPayload = {
      input: {
        action: 'enhance_skin_image_to_image',
        workflow: validatedData.workflow,
        params: validatedData.params,
        user_id: validatedData.user_id,
        job_id: jobId,
        webhook_url: webhookUrl,
      },
    };

    console.log('📋 RunPod payload prepared:', {
      action: runpodPayload.input.action,
      jobId,
      userId: validatedData.user_id,
      webhookUrl,
      workflowNodes: Object.keys(validatedData.workflow).length,
      promptLength: validatedData.params.positivePrompt.length,
    });

    // Create database entry for the generation job
    try {
      console.log('💾 Creating generation job in database...');
      
      const { PrismaClient } = await import('@/lib/generated/prisma');
      const prisma = new PrismaClient();

      await prisma.generationJob.create({
        data: {
          id: jobId,
          clerkId: userId,
          type: 'IMAGE_TO_IMAGE',
          status: 'PENDING',
          progress: 0,
          params: validatedData.params as any,
          message: 'Initializing image-to-image skin enhancement...',
          comfyUIPromptId: null,
        },
      });

      console.log('✅ Database job created successfully');
      await prisma.$disconnect();
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create generation job' },
        { status: 500 }
      );
    }

    console.log('📡 Sending to RunPod image-to-image skin enhancer:', RUNPOD_API_URL);

    // Send request to RunPod
    const runpodResponse = await fetch(`${RUNPOD_API_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify(runpodPayload),
    });

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('❌ RunPod API error:', {
        status: runpodResponse.status,
        statusText: runpodResponse.statusText,
        error: errorText,
      });

      // Update job status to failed
      try {
        const { PrismaClient } = await import('@/lib/generated/prisma');
        const prisma = new PrismaClient();
        
        await prisma.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            error: `RunPod API error: ${runpodResponse.status} ${runpodResponse.statusText}`,
            progress: 100,
          },
        });
        
        await prisma.$disconnect();
      } catch (updateError) {
        console.error('❌ Failed to update job status:', updateError);
      }

      return NextResponse.json(
        { error: `RunPod API error: ${runpodResponse.status}` },
        { status: 500 }
      );
    }

    const runpodResult = await runpodResponse.json();
    console.log('✅ RunPod response received:', {
      id: runpodResult.id,
      status: runpodResult.status,
    });

    // Update job with RunPod ID
    try {
      const { PrismaClient } = await import('@/lib/generated/prisma');
      const prisma = new PrismaClient();
      
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          progress: 5,
          message: 'Submitted to RunPod image-to-image skin enhancer...',
          // Store RunPod job ID if available
          comfyUIPromptId: runpodResult.id || null,
        },
      });
      
      await prisma.$disconnect();
    } catch (updateError) {
      console.error('❌ Failed to update job with RunPod ID:', updateError);
    }

    return NextResponse.json({
      success: true,
      jobId,
      runpodId: runpodResult.id,
      message: 'Image-to-image skin enhancement started successfully',
    });

  } catch (error) {
    console.error('❌ Image-to-image skin enhancer API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Image-to-Image Skin Enhancer API is running' },
    { status: 200 }
  );
}