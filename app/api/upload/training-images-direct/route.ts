// app/api/upload/training-images-direct/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// This endpoint only handles metadata, not files
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('=== DIRECT TRAINING IMAGE METADATA ===');
    console.log('Metadata for user:', clerkId);

    // This endpoint just receives metadata about images that were uploaded directly to Cloudinary
    const { images } = await request.json();

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: 'Invalid image metadata' }, { status: 400 });
    }

    console.log(`📋 Recording metadata for ${images.length} training images`);

    // Just return the metadata - no actual file processing needed
    // since files were uploaded directly to Cloudinary by the client
    return NextResponse.json({
      success: true,
      images: images,
      count: images.length
    });

  } catch (error) {
    console.error('💥 Training image metadata error:', error);
    return NextResponse.json({
      error: 'Failed to process image metadata: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}
