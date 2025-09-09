import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Validation schema for face swap serverless requests
const faceSwapServerlessSchema = z.object({
  action: z.literal('generate_face_swap'),
  workflow: z.any(), // ComfyUI workflow JSON
  params: z.any().optional(), // Generation parameters
  originalFilename: z.string().min(1),
  newFaceFilename: z.string().min(1),
  maskFilename: z.string().optional(),
  generationType: z.string().optional(),
  // Base64 image data fields (optional, will be used if available)
  originalImageData: z.string().optional(),
  newFaceImageData: z.string().optional(),
  maskImageData: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('🎭 Face Swap Serverless API request body:', body);

    // Validate the request body
    const validatedData = faceSwapServerlessSchema.parse(body);
    
    // Generate unique job ID
    const jobId = uuidv4();
    
    // Get RunPod endpoint URL from environment
    const runpodEndpointUrl = process.env.RUNPOD_FACE_SWAP_ENDPOINT_URL;
    if (!runpodEndpointUrl) {
      console.error('RUNPOD_FACE_SWAP_ENDPOINT_URL not configured');
      return NextResponse.json({ 
        error: 'RunPod face swap endpoint not configured' 
      }, { status: 500 });
    }

    // Get base URL for image and webhook URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
    
    // Get webhook URL for status updates
    const webhookUrl = `${baseUrl}/api/webhooks/generation-status`;
    
    // Construct proper image URLs (files are in public/uploads/)
    const originalImageUrl = `${baseUrl}/uploads/${validatedData.originalFilename}`;
    const newFaceImageUrl = `${baseUrl}/uploads/${validatedData.newFaceFilename}`;
    const maskImageUrl = validatedData.maskFilename ? `${baseUrl}/uploads/${validatedData.maskFilename}` : undefined;
    
    // Create generation job record in database
    const generationJob = await prisma.generationJob.create({
      data: {
        id: jobId,
        clerkId: userId,
        status: 'PENDING',
        type: 'FACE_SWAP',
        params: validatedData.params || {},
        progress: 0,
      },
    });

    console.log('✅ Created face swap generation job:', generationJob.id);

    // Prepare the RunPod request payload
    const runpodPayload = {
      input: {
        action: validatedData.action,
        workflow: validatedData.workflow,
        originalFilename: validatedData.originalFilename,
        newFaceFilename: validatedData.newFaceFilename,
        maskFilename: validatedData.maskFilename,
        originalImageUrl: originalImageUrl,
        newFaceImageUrl: newFaceImageUrl,
        maskImageUrl: maskImageUrl,
        // Include base64 data if available (prioritized by handler)
        originalImageData: validatedData.originalImageData,
        newFaceImageData: validatedData.newFaceImageData,
        maskImageData: validatedData.maskImageData,
        webhookUrl: webhookUrl,
        jobId: jobId,
      }
    };

    console.log('🚀 Sending request to RunPod Face Swap endpoint:', runpodPayload);

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
      console.error('RunPod face swap request failed:', runpodResponse.status, errorText);
      
      // Update job status to failed
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { 
          status: 'FAILED',
          error: `RunPod request failed: ${runpodResponse.status} - ${errorText}`
        },
      });

      return NextResponse.json({ 
        error: 'Failed to submit face swap job to RunPod',
        details: errorText
      }, { status: 500 });
    }

    const runpodResult = await runpodResponse.json();
    console.log('📡 RunPod face swap response:', runpodResult);

    // Update job with RunPod details
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { 
        status: 'PROCESSING',
        progress: 5,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: jobId,
      runpodJobId: runpodResult.id,
      status: 'submitted',
      message: 'Face swap generation job submitted successfully'
    });

  } catch (error) {
    console.error('🔥 Face swap serverless API error:', error);
    
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