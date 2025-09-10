import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addJob, updateJob, GenerationJob as StoredGenerationJob } from '@/lib/jobsStorage';

// RunPod API configuration for Image-to-Video (using the same endpoint as text-to-image)
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID = process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID; // Using same endpoint
const RUNPOD_API_URL = `https://api.runpod.ai/v2/${RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID}/run`;

interface GenerationJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  resultUrls?: string[];
  error?: string;
  createdAt: Date;
  userId: string;
  params?: any;
  runpodJobId?: string;
  comfyUIPromptId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate environment variables
    if (!RUNPOD_API_KEY || !RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID) {
      console.error('❌ Missing RunPod configuration:', {
        hasApiKey: !!RUNPOD_API_KEY,
        hasEndpointId: !!RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID
      });
      return NextResponse.json(
        { error: 'RunPod configuration missing' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { workflow, params, imageData } = body;

    if (!workflow) {
      return NextResponse.json(
        { error: 'Missing workflow' },
        { status: 400 }
      );
    }

    if (!params.uploadedImage) {
      return NextResponse.json(
        { error: 'Missing uploaded image' },
        { status: 400 }
      );
    }

    // Log base64 data availability
    console.log('📦 Image base64 data available:', !!imageData);

    console.log('🎯 Starting RunPod image-to-video generation for user:', userId);
    console.log('📋 Generation params:', params);

    // Generate unique job ID
    const jobId = `img2vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create job in database
    const job: StoredGenerationJob = {
      id: jobId,
      clerkId: userId,
      userId: userId,
      status: "pending",
      createdAt: new Date(),
      params,
      progress: 0,
      type: 'IMAGE_TO_VIDEO'
    };

    await addJob(job);
    console.log('✅ Job created in database:', jobId);

    // Generate webhook URL for progress updates
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/generation/${jobId}` : null;
    
    // Debug webhook URL construction
    console.log('🔧 Webhook URL construction debug:');
    console.log('  NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('  BASE_URL:', process.env.BASE_URL);
    console.log('  VERCEL_URL:', process.env.VERCEL_URL);
    console.log('  Final baseUrl:', baseUrl);
    console.log('  Final webhookUrl:', webhookUrl);

    // Prepare RunPod payload for image-to-video generation
    const runpodPayload = {
      input: {
        action: 'generate_video', // Specify this is a video generation request
        generation_type: 'image_to_video', // Specify the generation type
        job_id: jobId,
        workflow,
        params,
        webhook_url: webhookUrl,
        user_id: userId,
        base_url: baseUrl, // Add base URL so RunPod can download images
        imageData: imageData // Include base64 image data for serverless processing
      }
    };

    console.log('📡 Sending image-to-video to RunPod (shared endpoint):', RUNPOD_API_URL);
    console.log('🔗 Webhook URL:', webhookUrl);
    
    // Debug: Log the uploaded image being sent to RunPod
    if (params.uploadedImage) {
      console.log('🖼️ Uploaded image for video generation:', params.uploadedImage);
    }

    // Submit job to RunPod
    const runpodResponse = await fetch(RUNPOD_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(runpodPayload)
    });

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('❌ RunPod submission failed:', runpodResponse.status, errorText);
      
      // Update job status to failed
      await updateJob(jobId, {
        status: 'failed',
        error: `RunPod submission failed: ${runpodResponse.status}`
      });

      return NextResponse.json(
        { error: `RunPod submission failed: ${runpodResponse.status}` },
        { status: 500 }
      );
    }

    const runpodResult = await runpodResponse.json();
    console.log('✅ RunPod job submitted:', runpodResult);

    // Update job with RunPod job ID
    if (runpodResult.id) {
      const updatedParams = {
        ...params,
        runpodJobId: runpodResult.id
      };
      
      await updateJob(jobId, {
        params: updatedParams,
        status: 'processing'
      });
    }

    // Return job ID to frontend for polling
    return NextResponse.json({
      success: true,
      jobId,
      runpodJobId: runpodResult.id,
      message: 'Image-to-video generation started'
    });

  } catch (error) {
    console.error('❌ Image-to-video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
