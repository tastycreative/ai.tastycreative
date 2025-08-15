// app/api/user/influencers/direct-upload/route.ts - Direct upload with Vercel Blob storage
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 === DIRECT LORA UPLOAD ===');
    
    // Check authentication
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    console.log('👤 User:', userId);
    
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
    
    console.log('🚀 Attempting uploads to ComfyUI and Vercel Blob...');
    
    // Try to upload to both ComfyUI and Vercel Blob in parallel
    let uploadedToComfyUI = false;
    let comfyUIError: string | null = null;
    let blobUrl: string | null = null;
    let blobError: string | null = null;

    // Upload to ComfyUI and Blob storage in parallel
    const [comfyUIResult, blobResult] = await Promise.allSettled([
      uploadLoRAToComfyUI(file, uniqueFileName),
      uploadToBlobStorage(file, uniqueFileName)
    ]);

    // Process ComfyUI result
    if (comfyUIResult.status === 'fulfilled' && comfyUIResult.value) {
      uploadedToComfyUI = true;
      console.log('✅ Successfully uploaded to ComfyUI');
    } else {
      console.log('❌ Failed to upload to ComfyUI');
      comfyUIError = comfyUIResult.status === 'rejected' 
        ? comfyUIResult.reason?.message || 'ComfyUI upload failed'
        : 'ComfyUI upload returned false';
    }

    // Process Blob storage result
    if (blobResult.status === 'fulfilled' && blobResult.value) {
      blobUrl = blobResult.value;
      console.log('✅ Successfully uploaded to Vercel Blob:', blobUrl);
    } else {
      console.log('❌ Failed to upload to Vercel Blob');
      blobError = blobResult.status === 'rejected'
        ? blobResult.reason?.message || 'Blob upload failed'
        : 'Blob upload returned null';
    }

    // Create influencer metadata in database
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      clerkId: userId,
      name: baseName,
      displayName: displayName || baseName,
      fileName: uniqueFileName,
      originalFileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      isActive: uploadedToComfyUI,
      usageCount: 0,
      syncStatus: uploadedToComfyUI ? 'synced' : 'pending',
      description: description || undefined,
      comfyUIPath: uploadedToComfyUI ? `models/loras/${uniqueFileName}` : undefined,
      // blobUrl: blobUrl || undefined // Temporarily disabled until schema migration
    };
    
    // Add to database
    console.log('💾 Saving influencer to database...');
    await addUserInfluencer(userId, influencer);
    console.log('✅ Influencer saved to database');
    
    return NextResponse.json({
      success: true,
      message: 'LoRA uploaded successfully',
      uploads: {
        comfyUI: uploadedToComfyUI,
        blobStorage: !!blobUrl,
        comfyUIError: comfyUIError,
        blobError: blobError
      },
      influencer: {
        id: influencer.id,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        fileSize: influencer.fileSize,
        uploadedAt: influencer.uploadedAt,
        isActive: influencer.isActive,
        blobUrl: blobUrl,
        // blobUrl: blobUrl,
        comfyUIPath: influencer.comfyUIPath
      },
      uploadedToComfyUI,
      comfyUIError: comfyUIError || undefined,
      method: 'direct-upload'
    });
    
  } catch (error) {
    console.error('💥 Direct upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Direct upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to upload LoRA to Vercel Blob storage
async function uploadToBlobStorage(file: File, fileName: string): Promise<string | null> {
  try {
    console.log(`📤 Uploading ${fileName} to Vercel Blob storage...`);
    
    // Convert File to ArrayBuffer for Vercel Blob
    const arrayBuffer = await file.arrayBuffer();
    
    const blob = await put(fileName, arrayBuffer, {
      access: 'public',
      contentType: file.type || 'application/octet-stream'
    });
    
    console.log('✅ Blob storage upload successful:', blob.url);
    return blob.url;
    
  } catch (error) {
    console.error('❌ Error in uploadToBlobStorage:', error);
    return null;
  }
}

// Helper function to upload LoRA directly to ComfyUI
async function uploadLoRAToComfyUI(file: File, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`📤 Uploading ${fileName} directly to ComfyUI at ${COMFYUI_URL}`);
    
    // Create FormData for ComfyUI upload
    const formData = new FormData();
    formData.append('image', file, fileName); // ComfyUI expects 'image' field name
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    console.log('📡 Making request to ComfyUI...');
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(120000) // 2 minute timeout
    });
    
    console.log('📨 ComfyUI response status:', uploadResponse.status);
    
    if (uploadResponse.ok) {
      const responseText = await uploadResponse.text();
      console.log('✅ ComfyUI upload successful. Response:', responseText);
      return true;
    } else {
      console.error('❌ ComfyUI upload failed:', uploadResponse.status, uploadResponse.statusText);
      const responseText = await uploadResponse.text().catch(() => 'No response body');
      console.error('❌ ComfyUI response:', responseText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error in uploadLoRAToComfyUI:', error);
    
    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        console.error('❌ ComfyUI upload timed out');
      } else if (error.message.includes('fetch')) {
        console.error('❌ Network error connecting to ComfyUI');
      }
    }
    
    return false;
  }
}
