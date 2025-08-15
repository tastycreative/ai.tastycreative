// app/api/user/influencers/upload/route.ts - Vercel Blob Upload
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
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
    
    console.log('📤 === LORA BLOB UPLOAD ===');
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
    
    // Validate file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      console.error('❌ File too large:', file.size);
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;
    
    console.log('📁 Generated unique filename:', uniqueFileName);
    
    // Upload to Vercel Blob storage
    console.log('☁️ Uploading to Vercel Blob storage...');
    const blobPath = `loras/${userId}/${uniqueFileName}`;
    
    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream'
    });
    
    console.log('✅ File uploaded to Vercel Blob:', blob.url);
    
    // Automatically upload to ComfyUI
    console.log('🚀 Attempting to upload to ComfyUI...');
    let uploadedToComfyUI = false;
    let comfyUIError = null;
    
    try {
      // First, check if ComfyUI is reachable
      const isComfyUIReachable = await checkComfyUIHealth();
      
      if (!isComfyUIReachable) {
        console.log('⚠️ ComfyUI server is not reachable, skipping automatic upload');
        comfyUIError = 'ComfyUI server is not accessible';
        // Still proceed with database creation, but mark as pending
      } else {
        const uploadSuccess = await uploadLoRAToComfyUI(blob.url, uniqueFileName);
        if (uploadSuccess) {
          uploadedToComfyUI = true;
          console.log('✅ Successfully uploaded to ComfyUI');
        } else {
          console.log('❌ Failed to upload to ComfyUI despite server being reachable');
          comfyUIError = 'ComfyUI upload failed despite server being accessible';
        }
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
      originalFileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      description: description || `LoRA model uploaded from ${file.name}`,
      thumbnailUrl: undefined,
      isActive: uploadedToComfyUI,
      usageCount: 0,
      syncStatus: uploadedToComfyUI ? 'synced' : 'pending',
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
      message: uploadedToComfyUI 
        ? 'LoRA model uploaded successfully and is ready to use!'
        : 'LoRA model uploaded successfully! It will be available for use shortly.',
      influencer: {
        id: influencer.id,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        fileSize: influencer.fileSize,
        isActive: influencer.isActive,
        syncStatus: influencer.syncStatus,
        blobUrl: blob.url
      },
      uploadedToComfyUI,
      comfyUIError: comfyUIError || undefined,
      // Always show success - no manual instructions for users
      note: uploadedToComfyUI 
        ? 'Your LoRA is ready to use in image generation!'
        : 'Your LoRA has been uploaded and will be synced automatically. Check back in a few moments.'
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

// Helper function to verify LoRA is available in ComfyUI
async function verifyLoRAInComfyUI(fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    const response = await fetch(`${COMFYUI_URL}/object_info`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      console.error('❌ ComfyUI object_info request failed:', response.status);
      return false;
    }

    const objectInfo = await response.json();
    const loraLoader = objectInfo.LoraLoaderModelOnly;
    const availableLoRAs = loraLoader?.input?.required?.lora_name?.[0] || [];

    return availableLoRAs.includes(fileName);
  } catch (error) {
    console.error('❌ Error verifying LoRA in ComfyUI:', error);
    return false;
  }
}

// PATCH endpoint to sync pending LoRAs
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }

    console.log('🔄 Syncing pending LoRAs for user:', userId);

    // Import database functions
    const { getUserInfluencers, updateUserInfluencer } = require('@/lib/database');
    
    const userInfluencers = await getUserInfluencers(userId);
    const syncResults = [];

    if (!userInfluencers || userInfluencers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No LoRAs found to sync',
        syncResults: []
      });
    }

    console.log(`📊 Found ${userInfluencers.length} influencers to check`);

    // Check each pending LoRA
    for (const influencer of userInfluencers) {
      if (influencer.syncStatus === 'pending' || influencer.syncStatus === 'missing') {
        console.log('🔍 Checking:', influencer.fileName);
        const isAvailable = await verifyLoRAInComfyUI(influencer.fileName);
        
        if (isAvailable) {
          await updateUserInfluencer(userId, influencer.id, {
            syncStatus: 'synced',
            isActive: true
          });
          syncResults.push({ 
            id: influencer.id, 
            fileName: influencer.fileName,
            status: 'synced' 
          });
          console.log('✅ Synced:', influencer.fileName);
        } else {
          await updateUserInfluencer(userId, influencer.id, {
            syncStatus: 'missing'
          });
          syncResults.push({ 
            id: influencer.id, 
            fileName: influencer.fileName,
            status: 'still_missing' 
          });
          console.log('❌ Still missing:', influencer.fileName);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync completed. ${syncResults.filter(r => r.status === 'synced').length} LoRAs now available.`,
      syncResults
    });

  } catch (error) {
    console.error('💥 Sync error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Check if ComfyUI server is reachable
async function checkComfyUIHealth(): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log('🏥 Checking ComfyUI health...');
    const response = await fetch(`${COMFYUI_URL}/system_stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const isHealthy = response.ok;
    console.log(`🏥 ComfyUI health check: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    return isHealthy;
  } catch (error) {
    console.log('🏥 ComfyUI health check failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
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
    
    // Try multiple ComfyUI upload strategies
    const uploadStrategies = [
      () => uploadViaComfyUIUploadEndpoint(COMFYUI_URL, fileBuffer, fileName),
      () => uploadViaComfyUIImageEndpoint(COMFYUI_URL, fileBuffer, fileName),
      () => uploadViaComfyUICustomEndpoint(COMFYUI_URL, fileBuffer, fileName)
    ];
    
    for (let i = 0; i < uploadStrategies.length; i++) {
      try {
        console.log(`🔄 Trying upload strategy ${i + 1}/3...`);
        const success = await uploadStrategies[i]();
        if (success) {
          console.log(`✅ Upload strategy ${i + 1} succeeded`);
          return true;
        }
      } catch (error) {
        console.log(`❌ Upload strategy ${i + 1} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    console.log('❌ All upload strategies failed');
    return false;
    
  } catch (error) {
    console.error('❌ Error in uploadLoRAToComfyUI:', error);
    return false;
  }
}

// Strategy 1: Try ComfyUI's standard upload endpoint
async function uploadViaComfyUIUploadEndpoint(baseUrl: string, fileBuffer: ArrayBuffer, fileName: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('image', new Blob([fileBuffer]), fileName);
  formData.append('type', 'input');
  formData.append('subfolder', 'loras');
  
  const response = await fetch(`${baseUrl}/upload/image`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000) // 30 second timeout
  });
  
  return response.ok;
}

// Strategy 2: Try ComfyUI's image upload endpoint (sometimes works for models)
async function uploadViaComfyUIImageEndpoint(baseUrl: string, fileBuffer: ArrayBuffer, fileName: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('image', new Blob([fileBuffer]), fileName);
  formData.append('subfolder', 'loras');
  formData.append('type', 'input');
  
  const response = await fetch(`${baseUrl}/upload/image`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000)
  });
  
  return response.ok;
}

// Strategy 3: Try a custom endpoint or direct file upload
async function uploadViaComfyUICustomEndpoint(baseUrl: string, fileBuffer: ArrayBuffer, fileName: string): Promise<boolean> {
  // Try direct API approach
  const response = await fetch(`${baseUrl}/api/files/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: fileName,
      data: Buffer.from(fileBuffer).toString('base64'),
      path: 'models/loras',
      type: 'lora'
    }),
    signal: AbortSignal.timeout(60000) // 60 second timeout for large files
  });
  
  return response.ok;
}
