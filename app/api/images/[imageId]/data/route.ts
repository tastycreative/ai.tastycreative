import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from "@/lib/clerk-compat";
import { getImageData } from '@/lib/imageStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    // Try to get user from session/cookies (works with browser requests)
    const user = await currentUser();
    
    if (!user) {
      console.log('🔒 No authenticated user found for image request');
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to view images' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { imageId } = await params;
    console.log('🖼️ Serving image data for:', imageId, 'to user:', userId);

    // Get image data from database
    const imageData = await getImageData(imageId, userId);
    
    if (!imageData) {
      console.error('❌ Image not found:', imageId);
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    console.log('✅ Serving image:', {
      filename: imageData.filename,
      format: imageData.format,
      size: imageData.data.length
    });

    // Determine content type
    const contentType = imageData.format === 'png' ? 'image/png' : 
                       imageData.format === 'jpg' || imageData.format === 'jpeg' ? 'image/jpeg' :
                       'image/png'; // default to PNG

    // Return image data with proper headers
    return new NextResponse(new Uint8Array(imageData.data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageData.data.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Disposition': `inline; filename="${imageData.filename}"`,
      },
    });

  } catch (error) {
    console.error('💥 Error serving image data:', error);
    return NextResponse.json(
      { error: 'Failed to serve image data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
