// app/api/user/influencers/upload-direct/route.ts - Direct ComfyUI Upload + Vercel Blob Backup
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
    
    console.log('📤 === DIRECT COMFYUI UPLOAD ===');
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
    
    // Step 1: Upload directly to ComfyUI first (for immediate use)
    console.log('🚀 Uploading directly to ComfyUI...');
    let uploadedToComfyUI = false;
    let comfyUIError = null;
    
    try {
      const uploadSuccess = await uploadLoRAToComfyUI(file, uniqueFileName);
      if (uploadSuccess) {
        uploadedToComfyUI = true;
        console.log('✅ Successfully uploaded to ComfyUI');
      } else {
        console.log('❌ Failed to upload to ComfyUI');
        comfyUIError = 'ComfyUI upload failed';
        return NextResponse.json(
          { success: false, error: 'ComfyUI upload failed', details: comfyUIError },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ ComfyUI upload error:', error);
      comfyUIError = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { success: false, error: 'ComfyUI upload failed', details: comfyUIError },
        { status: 500 }
      );
    }
    
    // Step 2: Backup to Vercel Blob storage (for redundancy)
    let blobUrl = null;
    try {
      console.log('☁️ Backing up to Vercel Blob storage...');
      const blobPath = `loras/${userId}/${uniqueFileName}`;
      
      const blob = await put(blobPath, file, {
        access: 'public',
        contentType: file.type || 'application/octet-stream'
      });
      
      blobUrl = blob.url;
      console.log('✅ File backed up to Vercel Blob:', blobUrl);
    } catch (blobError) {
      console.warn('⚠️ Blob backup failed (but ComfyUI upload succeeded):', blobError);
      // Don't fail the entire upload just because blob backup failed
    }
    
    // Step 3: Create influencer metadata in database (only if ComfyUI upload succeeded)
    if (uploadedToComfyUI) {
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
        isActive: true,
        usageCount: 0,
        syncStatus: 'synced',
        lastUsedAt: undefined,
        comfyUIPath: `models/loras/${uniqueFileName}`
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
      
      console.log('🎉 Upload completed successfully!');
      
      return NextResponse.json({
        success: true,
        message: 'LoRA model uploaded successfully and is ready to use!',
        influencer: {
          id: influencer.id,
          name: influencer.name,
          displayName: influencer.displayName,
          fileName: influencer.fileName,
          fileSize: influencer.fileSize,
          isActive: influencer.isActive,
          syncStatus: influencer.syncStatus,
          blobUrl: blobUrl // Include blob URL for reference
        },
        uploadedToComfyUI: true,
        blobBackup: !!blobUrl,
        note: 'Your LoRA is ready to use in image generation!'
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to upload to ComfyUI', details: comfyUIError },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('💥 Upload error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to upload LoRA directly to ComfyUI from file
async function uploadLoRAToComfyUI(file: File, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`📡 Uploading file directly to ComfyUI: ${fileName} (${file.size} bytes)`);
    
    // Try ComfyUI upload
    const formData = new FormData();
    formData.append('image', file, fileName);
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000) // 2 minute timeout for large files
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Successfully uploaded to ComfyUI');
      return true;
    } else {
      console.error('❌ ComfyUI upload failed:', uploadResponse.status);
      const responseText = await uploadResponse.text().catch(() => 'No response body');
      console.error('❌ ComfyUI response:', responseText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error in uploadLoRAToComfyUI:', error);
    return false;
  }
}
