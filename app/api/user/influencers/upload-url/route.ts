// app/api/user/influencers/upload-url/route.ts - Streaming upload endpoint
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

// Disable body parsing to handle large files
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    console.log('📤 === STREAMING LORA UPLOAD ===');
    console.log('👤 Processing LoRA upload for user:', userId);
    
    // Get the file stream directly from the request
    const contentType = request.headers.get('content-type') || '';
    const fileName = request.headers.get('x-filename') || 'upload.safetensors';
    const displayName = request.headers.get('x-display-name') || fileName.replace(/\.[^/.]+$/, '');
    const description = request.headers.get('x-description') || '';
    
    console.log('📋 Upload request data:', {
      fileName,
      contentType,
      displayName,
      hasBody: !!request.body
    });
    
    if (!request.body) {
      console.error('❌ No request body provided');
      return NextResponse.json(
        { success: false, error: 'No file data provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const isValidFile = validExtensions.some(ext => 
      fileName.toLowerCase().endsWith(ext)
    );
    
    if (!isValidFile) {
      console.error('❌ Invalid file type:', fileName);
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload .safetensors, .pt, or .ckpt files.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;
    
    console.log('📁 Generated unique filename:', uniqueFileName);
    
    // Upload to Vercel Blob storage using stream
    console.log('☁️ Uploading to Vercel Blob storage...');
    const blobPath = `loras/${userId}/${uniqueFileName}`;
    
    const blob = await put(blobPath, request.body, {
      access: 'public',
      contentType: contentType || 'application/octet-stream'
    });
    
    console.log('✅ File uploaded to Vercel Blob:', blob.url);
    
    // Get file size from content-length header or estimate from blob
    const contentLength = request.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength) : 0;
    
    // Automatically upload to ComfyUI
    console.log('🚀 Attempting to upload to ComfyUI...');
    let uploadedToComfyUI = false;
    let comfyUIError = null;
    
    try {
      const uploadSuccess = await uploadLoRAToComfyUI(blob.url, uniqueFileName);
      if (uploadSuccess) {
        uploadedToComfyUI = true;
        console.log('✅ Successfully uploaded to ComfyUI');
      } else {
        console.log('❌ Failed to upload to ComfyUI');
        comfyUIError = 'ComfyUI upload failed';
      }
    } catch (error) {
      console.error('❌ ComfyUI upload error:', error);
      comfyUIError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Create influencer metadata in database
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      clerkId: userId,
      name: baseName,
      displayName: displayName || baseName,
      fileName: uniqueFileName,
      originalFileName: fileName,
      fileSize: fileSize,
      uploadedAt: new Date().toISOString(),
      isActive: uploadedToComfyUI,
      usageCount: 0,
      syncStatus: uploadedToComfyUI ? 'synced' : 'pending',
      description: description || undefined,
      comfyUIPath: uploadedToComfyUI ? `models/loras/${uniqueFileName}` : undefined
    };
    
    // Add to database
    console.log('💾 Saving influencer to database...');
    await addUserInfluencer(userId, influencer);
    console.log('✅ Influencer saved to database');
    
    return NextResponse.json({
      success: true,
      message: 'LoRA uploaded successfully',
      influencer: {
        id: influencer.id,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        fileSize: influencer.fileSize,
        uploadedAt: influencer.uploadedAt,
        isActive: influencer.isActive
      },
      uploadedToComfyUI,
      comfyUIError: comfyUIError || undefined,
      blobUrl: blob.url,
      instructions: !uploadedToComfyUI ? {
        title: "LoRA Upload Complete!",
        note: "Your LoRA has been uploaded and will be automatically synced to ComfyUI. No manual work required!"
      } : undefined
    });
    
  } catch (error) {
    console.error('💥 Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to automatically upload LoRA to ComfyUI
async function uploadLoRAToComfyUI(blobUrl: string, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`� Downloading file from blob: ${blobUrl}`);
    
    // Download the file from Vercel Blob
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      console.error('❌ Failed to download from blob:', blobResponse.status);
      return false;
    }
    
    const fileBuffer = await blobResponse.arrayBuffer();
    console.log(`✅ Downloaded file from blob (${fileBuffer.byteLength} bytes)`);
    
    // Try ComfyUI upload
    const formData = new FormData();
    formData.append('image', new Blob([fileBuffer]), fileName);
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Successfully uploaded to ComfyUI');
      return true;
    } else {
      console.error('❌ ComfyUI upload failed:', uploadResponse.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error in uploadLoRAToComfyUI:', error);
    return false;
  }
}
