// app/api/user/influencers/upload/route.ts - FIXED upload endpoint
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15279';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request); // FIX: await
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    console.log('📤 === LORA UPLOAD ===');
    console.log('👤 Processing LoRA upload for user:', userId);
    console.log('🖥️ ComfyUI URL:', COMFYUI_URL);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string;
    
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
    
    // Convert file to buffer for potential file system operations
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log('📊 File processed:', {
      originalSize: file.size,
      bufferSize: buffer.length,
      sizeMatch: file.size === buffer.length
    });
    
    // Try multiple upload strategies to ComfyUI
    let uploadSuccess = false;
    let comfyUIPath = '';
    let uploadMethod = '';
    
    // Strategy 1: Check if ComfyUI has a custom upload endpoint
    try {
      console.log('🚀 Strategy 1: Trying ComfyUI custom upload endpoint...');
      
      const uploadFormData = new FormData();
      uploadFormData.append('file', new Blob([buffer]), uniqueFileName);
      uploadFormData.append('type', 'lora');
      uploadFormData.append('subfolder', 'loras');
      
      const uploadResponse = await fetch(`${COMFYUI_URL}/upload/model`, {
        method: 'POST',
        body: uploadFormData,
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(60000) // Increased to 60 seconds
      });
      
      console.log('📡 Custom upload response status:', uploadResponse.status);
      
      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        console.log('✅ ComfyUI custom upload successful:', result);
        comfyUIPath = `models/loras/${uniqueFileName}`;
        uploadSuccess = true;
        uploadMethod = 'custom_endpoint';
      } else {
        const errorText = await uploadResponse.text();
        console.log('❌ Custom upload failed:', uploadResponse.status, errorText.substring(0, 200));
      }
    } catch (uploadError) {
      console.log('⚠️ Custom upload endpoint error:', uploadError instanceof Error ? uploadError.message : 'Unknown error');
    }
    
    // Strategy 2: Try using the standard image upload endpoint (sometimes works for models)
    if (!uploadSuccess) {
      try {
        console.log('🚀 Strategy 2: Trying ComfyUI image upload endpoint...');
        
        const imageFormData = new FormData();
        imageFormData.append('image', new Blob([buffer]), uniqueFileName);
        imageFormData.append('subfolder', 'loras');
        imageFormData.append('type', 'input');
        
        const imageUploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
          method: 'POST',
          body: imageFormData,
          signal: AbortSignal.timeout(60000) // Increased to 60 seconds
        });
        
        console.log('📡 Image upload response status:', imageUploadResponse.status);
        
        if (imageUploadResponse.ok) {
          const result = await imageUploadResponse.json();
          console.log('✅ ComfyUI image upload successful:', result);
          comfyUIPath = `input/loras/${uniqueFileName}`;
          uploadSuccess = true;
          uploadMethod = 'image_endpoint';
        } else {
          const errorText = await imageUploadResponse.text();
          console.log('❌ Image upload failed:', imageUploadResponse.status, errorText.substring(0, 200));
        }
      } catch (imageUploadError) {
        console.log('⚠️ Image upload endpoint error:', imageUploadError instanceof Error ? imageUploadError.message : 'Unknown error');
      }
    }
    
    // Strategy 3: Try a direct API approach
    if (!uploadSuccess) {
      try {
        console.log('🚀 Strategy 3: Trying direct API upload...');
        
        const directUploadResponse = await fetch(`${COMFYUI_URL}/api/files/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: uniqueFileName,
            data: buffer.toString('base64'),
            path: 'models/loras',
            type: 'lora'
          }),
          signal: AbortSignal.timeout(60000) // Increased to 60 seconds
        });
        
        console.log('📡 Direct upload response status:', directUploadResponse.status);
        
        if (directUploadResponse.ok) {
          console.log('✅ Direct API upload successful');
          comfyUIPath = `models/loras/${uniqueFileName}`;
          uploadSuccess = true;
          uploadMethod = 'direct_api';
        } else {
          const errorText = await directUploadResponse.text();
          console.log('❌ Direct upload failed:', directUploadResponse.status, errorText.substring(0, 200));
        }
      } catch (directUploadError) {
        console.log('⚠️ Direct upload error:', directUploadError instanceof Error ? directUploadError.message : 'Unknown error');
      }
    }
    
    // If all upload methods failed, prepare for manual setup
    if (!uploadSuccess) {
      console.log('⚠️ All upload methods failed, requiring manual setup');
      comfyUIPath = `models/loras/${uniqueFileName}`;
      uploadMethod = 'manual_required';
    }
    
    // Create influencer metadata
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      clerkId: userId,
      name: baseName,
      displayName: displayName || baseName,
      fileName: uniqueFileName,
      originalFileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      description: description || '',
      isActive: uploadSuccess, // Only activate if upload succeeded
      usageCount: 0,
      comfyUIPath,
      syncStatus: uploadSuccess ? 'synced' : 'pending'
    };
    
    console.log('💾 Adding influencer metadata to database:', {
      id: influencer.id,
      fileName: influencer.fileName,
      uploadSuccess,
      syncStatus: influencer.syncStatus
    });
    
    // Add to database
    await addUserInfluencer(userId, influencer);
    
    console.log('✅ Influencer metadata saved successfully');
    
    // Prepare response based on upload success
    const responseData: any = {
      success: true,
      influencer,
      uploadedToComfyUI: uploadSuccess,
      uploadMethod,
      fileInfo: {
        originalName: file.name,
        uniqueName: uniqueFileName,
        size: file.size,
        comfyUIPath
      }
    };
    
    if (uploadSuccess) {
      responseData.message = `LoRA model uploaded successfully using ${uploadMethod}! It's ready to use.`;
      console.log('🎉 Upload completed successfully with method:', uploadMethod);
    } else {
      responseData.message = 'LoRA metadata saved. Manual setup required to activate.';
      responseData.instructions = {
        title: 'Manual Setup Required',
        steps: [
          `1. Download or locate your file: ${file.name}`,
          `2. Copy it to: ComfyUI/models/loras/${uniqueFileName}`,
          `3. Restart ComfyUI or refresh the model cache`,
          `4. Return to "My Influencers" and click "Sync with ComfyUI"`,
          `5. The model will then appear as "Ready to use"`
        ],
        note: 'ComfyUI may not have a file upload API enabled. Manual file placement is common for LoRA models.'
      };
      console.log('📋 Manual setup instructions prepared');
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('💥 Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Upload failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper function to verify LoRA is available in ComfyUI
async function verifyLoRAInComfyUI(fileName: string): Promise<boolean> {
  try {
    console.log('🔍 Verifying LoRA in ComfyUI:', fileName);
    const response = await fetch(`${COMFYUI_URL}/object_info`, {
      signal: AbortSignal.timeout(60000) // Increased to 60 seconds
    });
    
    if (!response.ok) {
      console.log('❌ ComfyUI object_info request failed:', response.status);
      return false;
    }
    
    const objectInfo = await response.json();
    const loraLoader = objectInfo.LoraLoaderModelOnly;
    
    if (loraLoader?.input?.required?.lora_name?.[0]) {
      const availableLoRAs = loraLoader.input.required.lora_name[0];
      const isAvailable = availableLoRAs.includes(fileName);
      console.log(`✅ LoRA ${fileName} verification result:`, isAvailable);
      console.log('📊 Available LoRAs:', availableLoRAs.length);
      return isAvailable;
    }
    
    console.log('❌ No LoRA loader found in ComfyUI object info');
    return false;
  } catch (error) {
    console.error('💥 Error verifying LoRA:', error);
    return false;
  }
}

// PATCH endpoint to sync pending LoRAs
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request); // FIX: await
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    const { action } = await request.json();
    
    console.log('🔄 === LORA SYNC PATCH ===');
    console.log('👤 User:', userId);
    console.log('🎬 Action:', action);
    
    if (action === 'sync_pending') {
      console.log('🔄 Syncing pending LoRAs for user:', userId);
      
      // Import the database functions here to avoid circular dependencies
      const { getUserInfluencers, updateUserInfluencer } = await import('@/lib/database');
      
      const userInfluencers = await getUserInfluencers(userId);
      const syncResults = [];
      
      console.log('📊 Total influencers to check:', userInfluencers.length);
      
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
      
      const summary = {
        total: syncResults.length,
        synced: syncResults.filter(r => r.status === 'synced').length,
        missing: syncResults.filter(r => r.status === 'still_missing').length
      };
      
      console.log('📊 Sync results:', summary);
      
      return NextResponse.json({
        success: true,
        syncResults,
        message: `Checked ${syncResults.length} LoRAs`,
        summary
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
    
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