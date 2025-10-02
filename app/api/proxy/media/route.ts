import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Proxying request to:', url);

    // Fetch the media file from the provided URL
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      console.error(`❌ Proxy fetch failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch media: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the content type and other headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    console.log(`✅ Proxy fetch successful: ${contentType}, ${contentLength} bytes`);

    // Stream the response back to the client
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || arrayBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('❌ Proxy error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Proxy request failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}