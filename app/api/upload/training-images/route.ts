import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file (Vercel limit)
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total (Conservative for Vercel)
const MAX_FILES_PER_BATCH = 5; // Limit concurrent uploads
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Configure route for large payloads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

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

      // Generate filename
      const timestamp = Date.now();
      const uniqueId = uuidv4().substring(0, 6);
      const extension = path.extname(file.name).toLowerCase() || '.jpg';
      const filename = `upload_${timestamp}_${uniqueId}${extension}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      // Save file
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/uploads/${filename}`;
      
      uploadedImages.push({
        filename,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: publicUrl
      });

      console.log(`✅ Saved training image ${i + 1}: ${filename}`);
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
