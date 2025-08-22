// app/api/images/[imageId]/data/route.ts - Serve image data from database
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getImageData } from '@/lib/imageStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { imageId } = await params;
    console.log('📤 Serving image data:', imageId, 'for user:', clerkId);
    
    if (!imageId) {
      return NextResponse.json(
        { error: 'Missing imageId parameter' },
        { status: 400 }
      );
    }
    
    const imageData = await getImageData(imageId, clerkId);
    
    if (!imageData) {
      return NextResponse.json(
        { error: 'Image not found or no data available' },
        { status: 404 }
      );
    }
    
    console.log('✅ Serving image:', imageData.filename, 'Size:', imageData.data.length, 'bytes');
    
    // Determine content type based on format
    let contentType = 'image/png'; // default
    if (imageData.format) {
      switch (imageData.format.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'webp':
          contentType = 'image/webp';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        default:
          // Try to guess from filename
          if (imageData.filename.endsWith('.jpg') || imageData.filename.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
          } else if (imageData.filename.endsWith('.webp')) {
            contentType = 'image/webp';
          } else if (imageData.filename.endsWith('.gif')) {
            contentType = 'image/gif';
          }
      }
    }
    
    // Return image data as response (convert Buffer to ArrayBuffer for NextResponse)
    // Always convert to Uint8Array, then get ArrayBuffer slice
    const uint8 = (imageData.data instanceof Uint8Array)
      ? imageData.data
      : new Uint8Array(imageData.data);
    let imageBody: ArrayBuffer;
    if (uint8.byteOffset === 0 && uint8.byteLength === uint8.buffer.byteLength && uint8.buffer instanceof ArrayBuffer) {
      imageBody = uint8.buffer;
    } else {
      // Copy to a new ArrayBuffer to guarantee type
      imageBody = Uint8Array.from(uint8).buffer;
    }
    return new NextResponse(imageBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(uint8.byteLength),
        'Content-Disposition': `inline; filename="${imageData.filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Last-Modified': new Date().toUTCString()
      }
    });
    
  } catch (error) {
    console.error('💥 Error serving image data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to serve image data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}