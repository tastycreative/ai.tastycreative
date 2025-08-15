// app/api/images/route.ts - Main images API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getUserImages, 
  getImageStats, 
  deleteImage,
  type GeneratedImage 
} from '@/lib/imageStorage';

// GET - Get user's images
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    console.log('🖼️ === IMAGES API GET ===');
    console.log('👤 User:', clerkId);
    
    const { searchParams } = new URL(request.url);
    const includeData = searchParams.get('includeData') === 'true';
    const jobId = searchParams.get('jobId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const statsOnly = searchParams.get('stats') === 'true';
    
    console.log('📋 Parameters:', { includeData, jobId, limit, offset, statsOnly });
    console.log('🔍 Will fetch images for user with jobId filter:', jobId ? jobId : 'ALL JOBS');
    
    if (statsOnly) {
      const stats = await getImageStats(clerkId);
      console.log('📊 Image stats:', stats);
      
      return NextResponse.json({
        success: true,
        stats
      });
    }
    
    const images = await getUserImages(clerkId, {
      includeData,
      jobId,
      limit,
      offset
    });
    
    console.log('✅ Found', images.length, 'images');
    
    // Don't return raw data in JSON response if includeData is true
    // Instead, provide URLs to fetch the data
    const responseImages = images.map(img => ({
      ...img,
      data: img.data ? `Data available (${img.data.length} bytes)` : undefined,
      dataUrl: img.data ? `/api/images/${img.id}/data` : undefined
    }));
    
    return NextResponse.json({
      success: true,
      images: responseImages,
      count: images.length
    });
    
  } catch (error) {
    console.error('💥 Error in images API:', error);
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