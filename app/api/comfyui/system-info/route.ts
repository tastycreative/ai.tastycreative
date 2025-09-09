import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const COMFYUI_URL = process.env.COMFYUI_URL;
    if (!COMFYUI_URL) {
      return NextResponse.json({ error: 'ComfyUI URL not configured' }, { status: 500 });
    }

    // Check file system structure via ComfyUI
    const response = await fetch(`${COMFYUI_URL}/system_stats`);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to connect to ComfyUI' }, { status: 500 });
    }

    const stats = await response.json();
    
    // Also try to get folder info if available
    let folderInfo = null;
    try {
      const folderResponse = await fetch(`${COMFYUI_URL}/object_info`);
      if (folderResponse.ok) {
        folderInfo = await folderResponse.json();
      }
    } catch (e) {
      console.log('Could not fetch folder info');
    }

    return NextResponse.json({
      success: true,
      comfyui_stats: stats,
      folder_info: folderInfo,
      message: 'ComfyUI system information retrieved'
    });

  } catch (error) {
    console.error('❌ ComfyUI system check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'System check failed' },
      { status: 500 }
    );
  }
}
