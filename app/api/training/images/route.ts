import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    console.log(`📤 Uploading ${files.length} training images for user ${userId}`);

    // Create user-specific directory
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'training', userId);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const uploadedFiles = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue; // Skip non-image files
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `training_${timestamp}_${randomStr}.${extension}`;
      
      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Save file
      const filePath = join(uploadDir, filename);
      await writeFile(filePath, buffer);

      uploadedFiles.push({
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: `/uploads/training/${userId}/${filename}`
      });

      console.log(`✅ Saved training image: ${filename} (${file.size} bytes)`);
    }

    return NextResponse.json({
      success: true,
      message: `Uploaded ${uploadedFiles.length} training images`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('❌ Training image upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload training images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle GET requests to serve uploaded training images
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string; filename: string } }
) {
  try {
    const requestingUserId = await getUserId(request);
    
    // Only allow users to access their own training images
    if (!requestingUserId || requestingUserId !== params.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const filePath = join(
      process.cwd(), 
      'public', 
      'uploads', 
      'training', 
      params.userId, 
      params.filename
    );

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // In a production environment, you might want to stream the file
    // For now, we'll redirect to the public URL
    return NextResponse.redirect(
      new URL(`/uploads/training/${params.userId}/${params.filename}`, request.url)
    );

  } catch (error) {
    console.error('❌ Training image serving error:', error);
    return NextResponse.json(
      { error: 'Failed to serve training image' },
      { status: 500 }
    );
  }
}
