import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const envVars = {
      COMFYUI_URL: process.env.COMFYUI_URL,
      NEXT_PUBLIC_COMFYUI_URL: process.env.NEXT_PUBLIC_COMFYUI_URL,
      RUNPOD_API_URL: process.env.RUNPOD_API_URL,
      RUNPOD_TEXT_TO_IMAGE_API_URL: process.env.RUNPOD_TEXT_TO_IMAGE_API_URL,
      RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID: process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_ID,
      DATABASE_URL: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
      RUNPOD_API_KEY: process.env.RUNPOD_API_KEY ? '✓ Set' : '✗ Missing',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? '✓ Set' : '✗ Missing',
    };

    return NextResponse.json({
      success: true,
      environment: envVars,
      message: 'Environment variables checked'
    });

  } catch (error) {
    console.error('❌ Environment check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Environment check failed' },
      { status: 500 }
    );
  }
}
