import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserImages, deleteImage } from '@/lib/imageStorage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
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

    const { imageId } = await params;
    console.log('🖼️ GET /api/images/[imageId]:', imageId, 'for user:', userId);

    // Get all user images and find the specific one
    const images = await getUserImages(userId, { includeData: false });
    const image = images.find(img => img.id === imageId);
    
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: image
    });

  } catch (error) {
    console.error('💥 Error in GET /api/images/[imageId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
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

    const { imageId } = await params;
    console.log('🗑️ DELETE /api/images/[imageId]:', imageId, 'for user:', userId);

    // Delete the image
    const success = await deleteImage(imageId, userId);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Image not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('💥 Error in DELETE /api/images/[imageId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
