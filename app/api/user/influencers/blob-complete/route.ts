// app/api/user/influencers/blob-complete/route.ts - Complete LoRA upload after blob storage
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    const { blobUrl, fileName, displayName, description, fileSize } = await request.json();
    
    console.log('📤 === COMPLETING LORA UPLOAD ===');
    console.log('👤 User:', userId);
    console.log('📁 File:', fileName);
    console.log('🔗 Blob URL:', blobUrl);
    
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
    
    // Automatically upload to ComfyUI
    console.log('🚀 Attempting to upload to ComfyUI...');
    let uploadedToComfyUI = false;
    let comfyUIError = null;
    
    try {
      const uploadSuccess = await uploadLoRAToComfyUI(blobUrl, uniqueFileName);
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
      fileSize: fileSize || 0,
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
      instructions: !uploadedToComfyUI ? {
        title: "LoRA Upload Complete!",
        note: "Your LoRA has been uploaded and will be automatically synced to ComfyUI. No manual work required!"
      } : undefined
    });
    
  } catch (error) {
    console.error('💥 Upload completion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Upload completion failed',
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
    console.log(`📡 Downloading file from blob: ${blobUrl}`);
    
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
