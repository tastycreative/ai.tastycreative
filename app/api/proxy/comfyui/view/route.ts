import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15833';

export async function GET(request: NextRequest) {
  try {
    // Try to get user from session/cookies (works with browser requests)
    const user = await currentUser();
    
    if (!user) {
      console.log('🔒 No authenticated user found for ComfyUI proxy request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const subfolder = searchParams.get('subfolder') || '';
    const type = searchParams.get('type') || 'output';

    if (!filename) {
      return NextResponse.json(
        { error: 'Missing filename parameter' },
        { status: 400 }
      );
    }

    console.log('🖼️ Proxying ComfyUI image request:', {
      filename,
      subfolder,
      type,
      userId
    });

    // Build ComfyUI view URL
    const comfyUIParams = new URLSearchParams({
      filename,
      subfolder,
      type
    });
    
    const comfyUIUrl = `${COMFYUI_URL}/view?${comfyUIParams.toString()}`;
    console.log('📡 Fetching from ComfyUI:', comfyUIUrl);

    // Fetch image from ComfyUI
    const response = await fetch(comfyUIUrl, {
      headers: {
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      console.error('❌ ComfyUI request failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Image not found on ComfyUI server' },
        { status: 404 }
      );
    }

    const imageData = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    console.log('✅ Successfully proxied image:', {
      filename,
      size: imageData.byteLength,
      contentType
    });

    // Return image with proper headers
    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageData.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('💥 Error in ComfyUI proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
