import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadMultipleToCloudinary } from '@/lib/cloudinaryService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Training images upload endpoint called');
    
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();
    
    // Extract files and captions
    const files: Array<{ buffer: Buffer; filename: string; caption?: string }> = [];
    const captions: { [key: string]: string } = {};
    
    // Process form data entries
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('caption_')) {
        const index = key.replace('caption_', '');
        captions[index] = value as string;
      } else if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const fileIndex = key.replace('image_', '');
        
        files.push({
          buffer,
          filename: value.name,
          caption: captions[fileIndex] || '',
        });
        
        console.log('📁 Processing file:', {
          name: value.name,
          size: value.size,
          type: value.type,
          caption: captions[fileIndex] || 'No caption'
        });
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No image files provided' },
        { status: 400 }
      );
    }

    console.log(`📤 Uploading ${files.length} training images to Cloudinary...`);

    // Upload to Cloudinary
    const uploadedFiles = await uploadMultipleToCloudinary(files, {
      folder: `training-images/${userId}`,
      tags: ['training', 'ai-toolkit', userId],
    });

    // Format response
    const images = uploadedFiles.map((file, index) => ({
      id: `training_${Date.now()}_${index}`,
      filename: file.original_filename, // Keep original for reference
      uniqueFilename: `upload_${Date.now()}_${index}_${file.original_filename}`, // Add unique filename
      originalFilename: file.originalFilename,
      caption: file.caption || '',
      url: file.secure_url,
      publicId: file.public_id,
      size: file.bytes,
      width: file.width,
      height: file.height,
      format: file.format,
      uploadedAt: new Date().toISOString(),
    }));

    console.log(`✅ Successfully uploaded ${images.length} training images`);

    return NextResponse.json({
      success: true,
      count: images.length,
      images,
      message: `Successfully uploaded ${images.length} training images`
    });

  } catch (error) {
    console.error('❌ Training images upload error:', error);
    
    // Return more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('File too large')) {
        return NextResponse.json(
          { error: 'One or more files are too large. Please reduce file sizes and try again.' },
          { status: 413 }
        );
      }
      
      if (error.message.includes('Invalid file type')) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload only image files (JPG, PNG, WebP, etc.).' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to upload training images' },
      { status: 500 }
    );
  }
}

// Configure the body size limit for this route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for bulk uploads

// Add proper CORS headers for local development
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
