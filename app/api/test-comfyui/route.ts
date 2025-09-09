import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const COMFYUI_URL = process.env.COMFYUI_URL;
    if (!COMFYUI_URL) {
      return NextResponse.json({ error: 'ComfyUI URL not configured' }, { status: 500 });
    }

    // Test ComfyUI connection and get system info
    const systemInfoResponse = await fetch(`${COMFYUI_URL}/system_stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!systemInfoResponse.ok) {
      return NextResponse.json({
        error: `ComfyUI connection failed: ${systemInfoResponse.status}`,
        comfyui_url: COMFYUI_URL
      }, { status: 500 });
    }

    const systemInfo = await systemInfoResponse.json();

    return NextResponse.json({
      success: true,
      comfyui_url: COMFYUI_URL,
      connection_status: 'connected',
      system_info: systemInfo,
      upload_endpoint: `${COMFYUI_URL}/upload/image`,
      models_path: 'models/loras/{userId}/',
      network_volume_path: '/workspace/ComfyUI/models/loras/{userId}/',
      message: 'ComfyUI is ready for large file uploads'
    });

  } catch (error) {
    console.error('❌ ComfyUI test error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Test failed',
      comfyui_url: process.env.COMFYUI_URL || 'not configured'
    }, { status: 500 });
  }
}
