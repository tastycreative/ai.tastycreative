// app/api/upload/training-images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
const MAX_FILES_PER_BATCH = 5; // Limit concurrent uploads
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Configure route for large payloads
export const maxDuration = 900; // 15 minutes (increased for larger batches)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // DEBUG: Check if env variables are loaded
    console.log('=== CLOUDINARY DEBUG ===');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING');
    console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING');
    console.log('API Secret:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING');
    console.log('========================');

    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('=== TRAINING IMAGE UPLOAD ===');
    console.log('Upload for user:', clerkId);

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No image files provided' }, { status: 400 });
    }

    // Limit number of files per batch to prevent timeout/memory issues
    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json({ 
        error: `Too many files in single request. Maximum ${MAX_FILES_PER_BATCH} files per batch. Consider uploading in smaller batches.` 
      }, { status: 413 });
    }

    // Check total upload size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json({ 
        error: `Total upload size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit of ${MAX_TOTAL_SIZE / 1024 / 1024}MB. Try smaller batches or compress images.` 
      }, { status: 413 });
    }

    console.log(`📁 Uploading ${files.length} training images (${Math.round(totalSize / 1024 / 1024)}MB total)`);

    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file
      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Skipping invalid file type: ${file.type}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Skipping large file: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        continue;
      }

      try {
        // Generate filename
        const timestamp = Date.now();
        const uniqueId = uuidv4().substring(0, 6);
        const extension = path.extname(file.name).toLowerCase() || '.jpg';
        const filename = `upload_${timestamp}_${uniqueId}`;

        // Convert file to buffer for Cloudinary
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to Cloudinary (simplified for debugging)
        const result = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'image',
              public_id: filename,
              folder: 'training-images', // Simplified folder name
              // Remove transformations for now to isolate the issue
            },
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload error:', error);
                reject(error);
              } else {
                resolve(result);
              }
            }
          ).end(buffer);
        });

        uploadedImages.push({
          filename: result.public_id,
          originalName: file.name,
          size: file.size,
          type: file.type,
          url: result.secure_url,
          cloudinaryId: result.public_id, // Store for potential deletion later
        });

        console.log(`✅ Saved training image ${i + 1}: ${filename} to Cloudinary`);
      } catch (error) {
        console.error(`❌ Failed to upload ${file.name}:`, error);
        // Continue with other files instead of failing completely
      }
    }

    console.log(`🎉 Successfully uploaded ${uploadedImages.length} training images`);

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      count: uploadedImages.length
    });

  } catch (error) {
    console.error('💥 Training image upload error:', error);
    return NextResponse.json({
      error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}