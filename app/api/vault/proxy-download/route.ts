import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Fetch the file from S3
    const response = await fetch(url, {
      headers: {
        'Accept': '*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    // Get the file as a buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Return the file data as a blob
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('Proxy download error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to download file' },
      { status: 500 }
    );
  }
}
