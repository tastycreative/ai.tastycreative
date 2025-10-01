import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJobImages } from '@/lib/imageStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = await params;
    console.log('🖼️ Getting images for job:', jobId);

    // Get images for job
    const images = await getJobImages(jobId, { includeData: false });
    
    console.log(`📊 Found ${images.length} images for job ${jobId}`);

    return NextResponse.json({
      success: true,
      images: images.map(img => ({
        id: img.id,
        filename: img.filename,
        subfolder: img.subfolder,
        type: img.type,
        fileSize: img.fileSize,
        width: img.width,
        height: img.height,
        format: img.format,
        createdAt: img.createdAt,
        url: img.url,        // ComfyUI direct URL (if available)
        dataUrl: img.dataUrl, // Database-served URL
        s3Key: img.s3Key,    // Legacy S3 key for network volume storage
        networkVolumePath: img.networkVolumePath, // Network volume path
        // AWS S3 fields for direct access
        awsS3Key: img.awsS3Key,
        awsS3Url: img.awsS3Url
      })),
      count: images.length
    });

  } catch (error) {
    console.error('❌ Job images error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
