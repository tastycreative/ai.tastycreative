import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const hasRunPodKey = !!process.env.RUNPOD_API_KEY;
    const hasEndpointId = !!process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID;
    const comfyUIUrl = process.env.COMFYUI_URL || 'http://localhost:8188';
    
    console.log('🔍 RunPod Text-to-Image Test Endpoint');
    console.log('Environment check:', {
      hasRunPodKey,
      hasEndpointId,
      comfyUIUrl
    });

    return NextResponse.json({
      success: true,
      message: 'RunPod Text-to-Image API Test',
      timestamp: new Date().toISOString(),
      environment: {
        hasRunPodApiKey: hasRunPodKey,
        hasEndpointId: hasEndpointId,
        comfyUIUrl: comfyUIUrl,
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      endpoints: {
        generation: '/api/generate/text-to-image-runpod',
        jobStatus: '/api/jobs/[jobId]',
        jobImages: '/api/jobs/[jobId]/images',
        webhook: '/api/webhooks/generation/[jobId]'
      },
      requiredEnvVars: [
        'RUNPOD_API_KEY',
        'RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID',
        'COMFYUI_URL (optional, defaults to localhost:8188)',
        'NEXT_PUBLIC_BASE_URL (for webhooks)'
      ]
    });

  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}
