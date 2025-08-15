import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14967';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters from the request
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const subfolder = searchParams.get('subfolder');
    const type = searchParams.get('type');

    if (!filename) {
      return NextResponse.json({ error: 'Missing filename parameter' }, { status: 400 });
    }

    // Build ComfyUI URL
    const comfyUIParams = new URLSearchParams({
      filename,
      subfolder: subfolder || '',
      type: type || 'output'
    });
    
    const comfyUIUrl = `${COMFYUI_URL}/view?${comfyUIParams.toString()}`;
    console.log('🎬 Proxying ComfyUI request:', comfyUIUrl);

    // Fetch from ComfyUI
    const response = await fetch(comfyUIUrl, {
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (!response.ok) {
      console.error('❌ ComfyUI request failed:', response.status);
      return NextResponse.json(
        { error: `ComfyUI server error: ${response.status}` },
        { status: response.status }
      );
    }

    // Get content type from ComfyUI response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Stream the response
    const body = await response.arrayBuffer();
    
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Length': body.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('💥 Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy ComfyUI content' },
      { status: 500 }
    );
  }
}
