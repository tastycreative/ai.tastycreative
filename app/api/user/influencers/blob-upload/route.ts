// app/api/user/influencers/blob-upload/route.ts - Server-side blob upload with larger limits
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getUserId } from '@/lib/database';

// Configure for large payloads - this should help with 413 errors
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    console.log('🎯 === BLOB UPLOAD API ===');
    console.log('👤 User:', userId);
    
    // Get file from request body directly
    if (!request.body) {
      return NextResponse.json(
        { success: false, error: 'No file data provided' },
        { status: 400 }
      );
    }
    
    // Get metadata from headers
    const fileName = request.headers.get('x-filename') || 'upload.safetensors';
    const timestamp = Date.now();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const blobPath = `loras/${userId}/${timestamp}_${baseName}${fileExtension}`;
    
    console.log('📁 Uploading to blob path:', blobPath);
    
    // Upload directly to Vercel Blob using the request stream
    const blob = await put(blobPath, request.body, {
      access: 'public',
      contentType: 'application/octet-stream'
    });
    
    console.log('✅ Blob upload successful:', blob.url);
    
    return NextResponse.json({
      success: true,
      blobUrl: blob.url,
      fileName: fileName
    });
    
  } catch (error) {
    console.error('💥 Blob upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Blob upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
