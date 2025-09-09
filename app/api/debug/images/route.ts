import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get all generated images to debug
    const allImages = await prisma.generatedImage.findMany({
      select: {
        id: true,
        clerkId: true,
        jobId: true,
        filename: true,
        type: true,
        data: false, // Don't include base64 data in response
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Limit to recent 20
    });

    console.log('🔍 Debug: Found', allImages.length, 'images in database');
    
    return NextResponse.json({
      success: true,
      totalImages: allImages.length,
      images: allImages
    });
    
  } catch (error) {
    console.error('💥 Error in debug images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug images', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
