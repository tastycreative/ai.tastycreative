import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Validation schemas for different action types
const textToImageSchema = z.object({
  action: z.literal('generate_text_to_image'),
  workflow: z.any().optional(), // ComfyUI workflow JSON
  params: z.any().optional(), // Generation parameters
  prompt: z.string().optional(),
  aspect_ratio: z.string().optional(),
  model: z.string().optional(),
  seed: z.number().optional(),
  steps: z.number().min(1).max(50).optional(),
  guidance: z.number().min(1).max(20).optional(),
});

const styleTransferSchema = z.object({
  action: z.literal('generate_style_transfer'),
  workflow: z.any().optional(), // ComfyUI workflow JSON
  params: z.any().optional(), // Generation parameters
  generation_type: z.string().optional(),
  referenceImage: z.string().min(1), // Uploaded reference image filename
  maskImage: z.string().optional(), // Optional mask filename
  referenceImageData: z.string().optional(), // Base64 image data
  maskImageData: z.string().optional(), // Base64 mask data
  // Legacy fields for compatibility
  prompt: z.string().optional(),
  style_image_url: z.string().optional(),
  content_image_url: z.string().optional(),
  style_strength: z.number().min(0).max(1).optional(),
  seed: z.number().optional(),
});

const imageToVideoSchema = z.object({
  action: z.literal('generate_image_to_video'),
  workflow: z.any().optional(), // ComfyUI workflow JSON
  params: z.any().optional(), // Generation parameters
  image_url: z.string().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  seed: z.number().optional(),
});

const serverlessRequestSchema = z.discriminatedUnion('action', [
  textToImageSchema,
  styleTransferSchema,
  imageToVideoSchema,
]);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('Serverless API request body:', body);

    // Validate the request body
    const validatedData = serverlessRequestSchema.parse(body);
    
    // Generate unique job ID
    const jobId = uuidv4();
    
    // Get RunPod endpoint URL from environment
    const runpodEndpointUrl = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_URL;
    if (!runpodEndpointUrl) {
      console.error('RUNPOD_TEXT_TO_IMAGE_ENDPOINT_URL not configured');
      return NextResponse.json({ 
        error: 'RunPod endpoint not configured' 
      }, { status: 500 });
    }

    // Get webhook URL for status updates
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhooks/runpod`;
    
    // Prepare the RunPod request payload
    const runpodPayload = {
      input: {
        ...validatedData,
        job_id: jobId,
        webhook_url: webhookUrl,
      }
    };

    console.log('Sending request to RunPod:', runpodPayload);

    // Make request to RunPod serverless endpoint
    const runpodResponse = await fetch(`${runpodEndpointUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify(runpodPayload),
    });

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('RunPod API error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to start serverless generation',
        details: errorText 
      }, { status: 500 });
    }

    const runpodData = await runpodResponse.json();
    console.log('RunPod response:', runpodData);

    // Map action to GenerationType
    let generationType: string;
    switch (validatedData.action) {
      case 'generate_text_to_image':
        generationType = 'TEXT_TO_IMAGE';
        break;
      case 'generate_style_transfer':
        generationType = 'IMAGE_TO_IMAGE';
        break;
      case 'generate_image_to_video':
        generationType = 'IMAGE_TO_VIDEO';
        break;
      default:
        generationType = 'TEXT_TO_IMAGE';
    }

    // Store job in database
    await prisma.generationJob.create({
      data: {
        id: jobId,
        clerkId: userId,
        type: generationType as any,
        status: 'PROCESSING',
        params: {
          ...validatedData,
          runpodJobId: runpodData.id,
        },
        comfyUIPromptId: runpodData.id, // Store RunPod job ID here
        createdAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      jobId,
      runpodJobId: runpodData.id,
      status: 'RUNNING',
    });

  } catch (error) {
    console.error('Serverless API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Get job status from database
    const job = await prisma.generationJob.findFirst({
      where: {
        id: jobId,
        clerkId: userId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      result: job.resultUrls,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });

  } catch (error) {
    console.error('Get job status error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
