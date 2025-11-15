import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { workflow, params } = body;

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow is required' },
        { status: 400 }
      );
    }

    // Create a generation job in the database
    const job = await prisma.generationJob.create({
      data: {
        clerkId: userId,
        type: 'TEXT_TO_VIDEO',
        status: 'PENDING',
        progress: 0,
        params: params || {},
      },
    });

    // Prepare webhook URL for RunPod to send updates (must match image-to-video pattern)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/generation/${job.id}` : null;
    
    console.log('🔧 Webhook URL for text-to-video:', webhookUrl);

    // Call RunPod serverless endpoint
    const runpodResponse = await fetch(
      `${process.env.RUNPOD_TEXT_TO_VIDEO_ENDPOINT_URL}/run`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            action: 'generate_text_to_video',
            workflow,
            userId,
            webhook_url: webhookUrl,
            jobId: job.id,  // Changed from job_id to jobId for consistency
          },
        }),
      }
    );

    if (!runpodResponse.ok) {
      const errorText = await runpodResponse.text();
      console.error('RunPod API error:', errorText);
      
      // Update job status to failed
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: `RunPod API error: ${errorText}`,
        },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to start generation on RunPod' },
        { status: 500 }
      );
    }

    const runpodData = await runpodResponse.json();
    console.log('RunPod response:', runpodData);

    // Update job with RunPod job ID
    if (runpodData.id) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          comfyUIPromptId: runpodData.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      runpodJobId: runpodData.id,
    });
  } catch (error) {
    console.error('Error in text-to-video generation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
