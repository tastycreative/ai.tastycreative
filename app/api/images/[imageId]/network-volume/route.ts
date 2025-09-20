import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    // Try to get user from session/cookies (works with browser requests)
    const user = await currentUser();
    
    if (!user) {
      console.log('🔒 No authenticated user found for network volume image request');
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to view images' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const { imageId } = await params;
    console.log('🖼️ Serving network volume image for:', imageId, 'to user:', userId);

    // Get image record from database with network volume path
    const imageRecord = await prisma.generatedImage.findFirst({
      where: {
        id: imageId,
        clerkId: userId, // Ensure user can only access their own images
        networkVolumePath: { not: null } // Must have network volume path
      },
      select: {
        filename: true,
        networkVolumePath: true,
        format: true,
        fileSize: true
      }
    });
    
    if (!imageRecord || !imageRecord.networkVolumePath) {
      console.error('❌ Network volume image not found:', imageId);
      return NextResponse.json(
        { error: 'Image not found on network volume' },
        { status: 404 }
      );
    }

    console.log('✅ Found network volume image:', {
      filename: imageRecord.filename,
      path: imageRecord.networkVolumePath,
      format: imageRecord.format,
      size: imageRecord.fileSize
    });

    // Check if we're running in a serverless environment (where network volume is accessible)
    const isServerless = process.env.RUNPOD_SERVERLESS === 'true';
    const isLocalDev = process.env.NODE_ENV === 'development';
    
    if (!isServerless && !isLocalDev) {
      // In production frontend, we can't directly access network volume
      // Return a proxy URL that will be handled by the serverless function
      const proxyUrl = `${process.env.RUNPOD_TEXT_TO_IMAGE_ENDPOINT_URL}/proxy/image/${imageId}`;
      return NextResponse.redirect(proxyUrl);
    }

    try {
      // Try to read the file from network volume
      const imageBuffer = await fs.readFile(imageRecord.networkVolumePath);
      
      // Determine content type
      const contentType = imageRecord.format === 'png' ? 'image/png' : 
                         imageRecord.format === 'jpg' || imageRecord.format === 'jpeg' ? 'image/jpeg' :
                         'image/png'; // default to PNG

      console.log('✅ Serving network volume image:', {
        filename: imageRecord.filename,
        size: imageBuffer.length
      });

      // Return image data with proper headers
      return new NextResponse(new Uint8Array(imageBuffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': imageBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'Content-Disposition': `inline; filename="${imageRecord.filename}"`,
        },
      });

    } catch (fileError) {
      console.error('❌ Error reading file from network volume:', fileError);
      
      // If file doesn't exist on network volume, fall back to database image serving
      console.log('🔄 Falling back to database image serving...');
      return NextResponse.redirect(`/api/images/${imageId}/data`);
    }

  } catch (error) {
    console.error('💥 Error serving network volume image:', error);
    return NextResponse.json(
      { error: 'Failed to serve network volume image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}