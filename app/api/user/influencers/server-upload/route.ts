// app/api/user/influencers/server-upload/route.ts - Server-side blob upload alternative
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 === SERVER-SIDE BLOB UPLOAD ===');
    
    // Check authentication
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    console.log('👤 User:', userId);
    
    // Check if we have the blob token
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      console.error('❌ Missing BLOB_READ_WRITE_TOKEN environment variable');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Missing blob token' },
        { status: 500 }
      );
    }
    
    // Get the file from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log('📁 File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const isValidFile = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!isValidFile) {
      console.error('❌ Invalid file type:', file.name);
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload .safetensors, .pt, or .ckpt files.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;
    
    console.log('☁️ Uploading to Vercel Blob:', uniqueFileName);
    
    // Upload to Vercel Blob using server-side API
    const blob = await put(uniqueFileName, file, {
      access: 'public',
      token: blobToken,
    });
    
    console.log('✅ Server-side blob upload completed:', blob.url);
    
    // Now process the blob (ComfyUI upload + database) - reuse the existing endpoint logic
    const processResponse = await fetch(`${request.nextUrl.origin}/api/user/influencers/blob-complete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-clerk-user-id': userId // Pass user ID in header for internal call
      },
      body: JSON.stringify({
        blobUrl: blob.url,
        fileName: file.name,
        displayName: displayName || baseName,
        description: description || '',
        fileSize: file.size,
      }),
    });
    
    if (!processResponse.ok) {
      const errorText = await processResponse.text();
      console.error('❌ Processing failed:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to process uploaded file', details: errorText },
        { status: 500 }
      );
    }
    
    const processResult = await processResponse.json();
    console.log('✅ Processing completed:', processResult.success);
    
    return NextResponse.json({
      success: true,
      blobUrl: blob.url,
      processResult,
      method: 'server-side'
    });
    
  } catch (error) {
    console.error('💥 Server-side upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Server-side upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
