import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { clerkId: string; filename: string } }
) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    
    // Check if user is authorized to access this image
    if (!userId || userId !== params.clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Construct the file path
    const uploadDir = '/tmp/uploads/training';
    const filePath = path.join(uploadDir, params.filename);
    
    console.log(`📸 Serving training image: ${filePath}`);
    
    // Read the file
    const fileBuffer = await readFile(filePath);
    
    // Determine content type based on file extension
    const extension = path.extname(params.filename).toLowerCase();
    let contentType = 'image/jpeg'; // default
    
    switch (extension) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
    }
    
    // Return the image with proper headers
    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'ngrok-skip-browser-warning': 'true',
      },
    });
    
  } catch (error) {
    console.error('❌ Error serving training image:', error);
    
    if ((error as any).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}