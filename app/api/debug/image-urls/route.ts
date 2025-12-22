import { NextResponse } from 'next/server';
import { getUserImages } from '@/lib/imageStorage';

export async function GET() {
  try {
    // Test with the user who has the most recent image
    const testUserId = 'user_30dULT8ZLO1jthhCEgn349cKcvT';
    
    const images = await getUserImages(testUserId, {
      includeData: false,
      limit: 5
    });

    const imageUrls = images.map(img => ({
      id: img.id,
      filename: img.filename,
      hasUrl: !!img.url,
      hasDataUrl: !!img.dataUrl,
      url: img.url,
      dataUrl: img.dataUrl
    }));

    return NextResponse.json({
      success: true,
      count: images.length,
      imageUrls
    });

  } catch (error) {
    console.error('Error in debug image URLs endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
