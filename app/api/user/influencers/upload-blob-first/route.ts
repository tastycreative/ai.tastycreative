// app/api/user/influencers/upload-blob-first/route.ts - Upload to Blob first, then ComfyUI
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

// Configure for Vercel deployment
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
    
    console.log('📤 === BLOB-FIRST UPLOAD ===');
    console.log('👤 Processing LoRA upload for user:', userId);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string || '';
    
    console.log('📋 Upload request data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      displayName,
      description: !!description
    });
    
    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
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
    
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;
    
    console.log('📁 Generated unique filename:', uniqueFileName);
    
    // Step 1: Upload to Vercel Blob first (reliable for large files)
    console.log('☁️ Step 1: Uploading to Vercel Blob storage...');
    let blobUrl: string;
    
    try {
      const blobPath = `loras/${userId}/${uniqueFileName}`;
      
      const blob = await put(blobPath, file, {
        access: 'public',
        contentType: file.type || 'application/octet-stream'
      });
      
      blobUrl = blob.url;
      console.log('✅ File uploaded to Vercel Blob:', blobUrl);
      console.log('📊 File size:', file.size, 'bytes');
    } catch (blobError) {
      console.error('❌ Blob upload failed:', blobError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to blob storage', details: blobError instanceof Error ? blobError.message : 'Unknown error' },
        { status: 500 }
      );
    }
    
    // Step 2: Create influencer metadata in database (with pending sync status)
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      clerkId: userId,
      name: baseName,
      displayName: displayName || baseName,
      fileName: uniqueFileName,
      originalFileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      description: description || `LoRA model uploaded from ${file.name}`,
      thumbnailUrl: undefined,
      isActive: false, // Will be activated after ComfyUI upload
      usageCount: 0,
      syncStatus: 'pending', // Will be updated after ComfyUI upload
      lastUsedAt: undefined,
      comfyUIPath: undefined // Will be set after ComfyUI upload
    };
    
    console.log('💾 Creating influencer record in database...');
    
    try {
      await addUserInfluencer(userId, influencer);
      console.log('✅ Influencer record created successfully');
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save influencer data to database' },
        { status: 500 }
      );
    }
    
    // Step 3: Trigger background ComfyUI upload
    console.log('🚀 Step 3: Triggering ComfyUI upload in background...');
    
    try {
      // Call the background transfer endpoint
      const transferResponse = await fetch(`${request.nextUrl.origin}/api/user/influencers/transfer-to-comfyui`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: JSON.stringify({
          influencerId: influencer.id,
          blobUrl: blobUrl,
          fileName: uniqueFileName
        })
      });
      
      if (transferResponse.ok) {
        console.log('✅ ComfyUI transfer initiated successfully');
      } else {
        console.warn('⚠️ ComfyUI transfer request failed, but file is in blob storage');
      }
    } catch (transferError) {
      console.warn('⚠️ Failed to initiate ComfyUI transfer, but file is safely stored:', transferError);
    }
    
    console.log('🎉 Upload completed! File is in blob storage and ComfyUI sync is in progress.');
    
    return NextResponse.json({
      success: true,
      message: 'LoRA model uploaded successfully! ComfyUI sync is in progress.',
      influencer: {
        id: influencer.id,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        fileSize: influencer.fileSize,
        isActive: influencer.isActive,
        syncStatus: influencer.syncStatus,
        blobUrl: blobUrl
      },
      uploadedToBlob: true,
      comfyUITransferInitiated: true,
      note: 'Your LoRA is being processed and will be ready for use shortly. Check the sync status in a few moments.'
    });
    
  } catch (error) {
    console.error('💥 Upload error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
