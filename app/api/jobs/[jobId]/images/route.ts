// app/api/jobs/[jobId]/images/route.ts - Get images for a specific job
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getJob } from '@/lib/jobsStorage';
import { getJobImages } from '@/lib/imageStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { jobId } = await params;
    console.log('🖼️ Getting images for job:', jobId, 'user:', clerkId);
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }
    
    // Verify job exists and belongs to user
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    if (job.clerkId !== clerkId) {
      return NextResponse.json(
        { error: 'Access denied - job belongs to different user' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const includeData = searchParams.get('includeData') === 'true';
    
    const images = await getJobImages(jobId, { includeData });
    
    console.log('✅ Found', images.length, 'images for job:', jobId);
    
    // Format response (don't include raw data in JSON)
    const responseImages = images.map(img => ({
      ...img,
      data: img.data ? `Data available (${img.data.length} bytes)` : undefined,
      dataUrl: img.data ? `/api/images/${img.id}/data` : undefined
    }));
    
    return NextResponse.json({
      success: true,
      jobId,
      images: responseImages,
      count: images.length,
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        resultUrls: job.resultUrls // Original URLs for backward compatibility
      }
    });
    
  } catch (error) {
    console.error('💥 Error getting job images:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get job images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}