import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Image upload endpoint called');
    
    // Get the form data from the request
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const maskFile = formData.get('mask') as File | null;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    console.log('📁 Received image:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    });
    
    if (maskFile) {
      console.log('🎭 Received mask:', {
        name: maskFile.name,
        size: maskFile.size,
        type: maskFile.type
      });
    }
    
    // Convert File to Buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create a unique filename
    const timestamp = Date.now();
    const originalName = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const extension = imageFile.name.split('.').pop() || 'jpg';
    const filename = `${originalName}_${timestamp}.${extension}`;
    
    // Create uploads directory in public folder for easy access
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    try {
      // Ensure directory exists
      const { mkdir } = await import('fs/promises');
      await mkdir(uploadDir, { recursive: true });
      
      // Write image file to public/uploads directory
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);
      
      console.log('✅ Image saved to:', filePath);
      
      const response: any = {
        success: true,
        filename: filename,
        size: imageFile.size,
        type: imageFile.type,
        url: `/uploads/${filename}` // Public URL for accessing the image
      };
      
      // Handle mask file if provided
      if (maskFile) {
        const maskBytes = await maskFile.arrayBuffer();
        const maskBuffer = Buffer.from(maskBytes);
        
        const maskExtension = maskFile.name.split('.').pop() || 'png';
        const maskFilename = `${originalName}_mask_${timestamp}.${maskExtension}`;
        const maskFilePath = path.join(uploadDir, maskFilename);
        
        await writeFile(maskFilePath, maskBuffer);
        console.log('✅ Mask saved to:', maskFilePath);
        
        response.maskFilename = maskFilename;
        response.maskUrl = `/uploads/${maskFilename}`;
      }
      
      return NextResponse.json(response);
      
    } catch (writeError) {
      console.error('❌ Error saving file:', writeError);
      return NextResponse.json(
        { error: 'Failed to save image file' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// Configure the body size limit for this route
export const runtime = 'nodejs';
// export const maxDuration = 30; // 30 seconds max
