import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

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

    console.log(`📁 Uploading ${files.length} training images`);

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
        console.warn(`⚠️ Skipping large file: ${file.size} bytes`);
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
