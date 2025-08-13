import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file (Vercel limit)
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

    console.log('=== SINGLE TRAINING IMAGE UPLOAD ===');
    console.log('Upload for user:', clerkId);

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      }, { status: 413 });
    }

    console.log(`📁 Uploading single training image: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB)`);

    // Ensure upload directory exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

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
    
    const uploadedImage = {
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: publicUrl
    };

    console.log(`✅ Successfully uploaded training image: ${filename}`);

    return NextResponse.json({
      success: true,
      image: uploadedImage
    });

  } catch (error) {
    console.error('💥 Single training image upload error:', error);
    return NextResponse.json({
      error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}
