import { NextRequest, NextResponse } from 'next/server';
import { getJobImages } from '@/lib/imageStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    // Get images for job without authentication for debugging
    const images = await getJobImages(jobId, { includeData: false });
    
    console.log(`🔍 DEBUG: Found ${images.length} images for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      jobId,
      imageCount: images.length,
      images: images.map(img => ({
        id: img.id,
        filename: img.filename,
        fileSize: img.fileSize,
        width: img.width,
        height: img.height,
        hasDataUrl: !!img.dataUrl,
        hasUrl: !!img.url,
        createdAt: img.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Debug images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}