// app/api/images/route.ts - Main images API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getUserImages, 
  getImageStats, 
  deleteImage,
  getJobImages,
  type GeneratedImage 
} from '@/lib/imageStorage';

// Extend GeneratedImage to include generatedAt for local use
type GeneratedImageWithGeneratedAt = GeneratedImage & { generatedAt?: string };

// GET - Get user's images
// Replace the GET function in your app/api/images/route.ts with this:
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('🖼️ === ENHANCED IMAGES API GET ===');
    console.log('👤 User:', clerkId);
    
    const { searchParams } = new URL(request.url);
    const includeData = searchParams.get('includeData') === 'true';
    const includeJobImages = searchParams.get('includeJobImages') !== 'false'; // Default: true
    const jobId = searchParams.get('jobId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const statsOnly = searchParams.get('stats') === 'true';
    
    console.log('📋 Parameters:', { includeData, includeJobImages, jobId, limit, offset, statsOnly });
    
    if (statsOnly) {
      const stats = await getImageStats(clerkId);
      console.log('📊 Image stats:', stats);
      
      return NextResponse.json({
        success: true,
        stats
      });
    }
    
    // Get regular user images
    const regularImages = await getUserImages(clerkId, {
      includeData,
      jobId,
      limit,
      offset
    });
    let allImages: GeneratedImageWithGeneratedAt[] = [...regularImages];
    console.log('✅ Found', regularImages.length, 'regular images');
    
    // Also get job-generated images if requested
    if (includeJobImages && !jobId) { // Don't duplicate if filtering by specific job
      try {
        console.log('🔄 Fetching job-generated images...');
        
        // Import the function we just added
        const { getCompletedJobsForUser } = await import('@/lib/jobsStorage');
        
        // Get all completed jobs for this user
        const completedJobs = await getCompletedJobsForUser(clerkId);
        console.log('📊 Found', completedJobs.length, 'completed jobs');
        
        // Get images for each completed job
        for (const job of completedJobs) {
          try {
            const jobImages = await getJobImages(job.id, { includeData });
            
            if (jobImages.length > 0) {
              console.log('📸 Adding', jobImages.length, 'images from job:', job.id);
              
              // Mark as job-generated and avoid duplicates
              const existingIds = new Set(allImages.map(img => img.id));
              const newJobImages = jobImages
                .filter(img => !existingIds.has(img.id))
                .map(img => ({
                  ...img,
                  jobId: job.id,
                  source: 'text-to-image',
                  generatedAt: typeof job.createdAt === 'string' ? job.createdAt : job.createdAt.toISOString(),
                  // Use job creation time if image doesn't have createdAt
                  createdAt: img.createdAt || (typeof job.createdAt === 'string' ? job.createdAt : job.createdAt.toISOString())
                }));
              
              allImages = [...allImages, ...newJobImages];
            }
          } catch (jobError) {
            console.warn('⚠️ Failed to get images for job:', job.id, jobError);
          }
        }
        
        console.log('✅ Total images after including job images:', allImages.length);
        
      } catch (jobImagesError) {
        console.warn('⚠️ Failed to fetch job images:', jobImagesError);
        // Continue with just regular images
      }
    }
    
    // Sort by creation date (newest first)
    allImages.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.generatedAt || 0);
      const dateB = new Date(b.createdAt || b.generatedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Apply limit if specified
    if (limit && !jobId) {
      allImages = allImages.slice(0, limit);
    }
    
    // Don't return raw data in JSON response if includeData is true
    const responseImages = allImages.map(img => ({
      ...img,
      data: img.data ? `Data available (${img.data.length} bytes)` : undefined,
      dataUrl: img.data ? `/api/images/${img.id}/data` : undefined,
      // Ensure consistent date format
      createdAt: img.createdAt || img.generatedAt || new Date().toISOString()
    }));
    
    return NextResponse.json({
      success: true,
      images: responseImages,
      count: allImages.length,
      breakdown: {
        regular: regularImages.length,
        jobGenerated: allImages.length - regularImages.length
      },
      debug: {
        includeJobImages,
        requestedLimit: limit,
        actualReturned: responseImages.length
      }
    });
    
  } catch (error) {
    console.error('💥 Error in enhanced images API:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete user image
export async function DELETE(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get imageId from query string
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');

    if (!imageId) {
      return NextResponse.json(
        { error: 'Missing imageId' },
        { status: 400 }
      );
    }

    console.log('🗑️ Deleting image:', imageId, 'for user:', clerkId);

    const deleted = await deleteImage(imageId, clerkId);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete image or image not found'
        },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('💥 Error deleting image:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}