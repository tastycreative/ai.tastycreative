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
      isActive: true,
      usageCount: 0,
      syncStatus: 'pending', // Will need to be synced with ComfyUI later
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
      message: 'LoRA model uploaded successfully to Vercel Blob storage!',
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
      uploadedToComfyUI: false, // Will be synced later
      instructions: {
        title: 'Manual ComfyUI Setup Required',
        steps: [
          `1. Download the file from: ${blob.url}`,
          `2. Copy it to: ComfyUI/models/loras/${uniqueFileName}`,
          `3. Restart ComfyUI or refresh the model cache`,
          `4. Return to "My Influencers" and click "Sync with ComfyUI"`,
          `5. The model will then appear as "Ready to use"`
        ],
        note: 'Your LoRA is safely stored in Vercel Blob storage and can be downloaded anytime. Manual placement in ComfyUI is required for generation.'
      }
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
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14967';
  
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
