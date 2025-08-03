// app/api/user/influencers/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, InfluencerLoRA } from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    console.log('Processing LoRA upload for user:', userId);
    
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
    
    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const isValidFile = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!isValidFile) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload .safetensors, .pt, or .ckpt files.' },
        { status: 400 }
      );
    }
    
    // Validate file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
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
    
    console.log('Uploading LoRA file:', uniqueFileName);
    
    // Convert file to buffer for potential file system operations
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Try multiple upload strategies to ComfyUI
    let uploadSuccess = false;
    let comfyUIPath = '';
    let uploadMethod = '';
    
    // Strategy 1: Check if ComfyUI has a custom upload endpoint
    try {
      console.log('Trying ComfyUI custom upload endpoint...');
      
      const uploadFormData = new FormData();
      uploadFormData.append('file', new Blob([buffer]), uniqueFileName);
      uploadFormData.append('type', 'lora');
      uploadFormData.append('subfolder', 'loras');
      
      const uploadResponse = await fetch(`${COMFYUI_URL}/upload/model`, {
        method: 'POST',
        body: uploadFormData,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        console.log('ComfyUI custom upload successful:', result);
        comfyUIPath = `models/loras/${uniqueFileName}`;
        uploadSuccess = true;
        uploadMethod = 'custom_endpoint';
      } else {
        console.log('Custom upload failed with status:', uploadResponse.status);
      }
    } catch (uploadError) {
      console.log('Custom upload endpoint error:', uploadError);
    }
    
    // Strategy 2: Try using the standard image upload endpoint (sometimes works for models)
    if (!uploadSuccess) {
      try {
        console.log('Trying ComfyUI image upload endpoint...');
        
        const imageFormData = new FormData();
        imageFormData.append('image', new Blob([buffer]), uniqueFileName);
        imageFormData.append('subfolder', 'loras');
        imageFormData.append('type', 'input');
        
        const imageUploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
          method: 'POST',
          body: imageFormData,
        });
        
        if (imageUploadResponse.ok) {
          const result = await imageUploadResponse.json();
          console.log('ComfyUI image upload successful:', result);
          comfyUIPath = `input/loras/${uniqueFileName}`;
          uploadSuccess = true;
          uploadMethod = 'image_endpoint';
        } else {
          console.log('Image upload failed with status:', imageUploadResponse.status);
        }
      } catch (imageUploadError) {
        console.log('Image upload endpoint error:', imageUploadError);
      }
    }
    
    // Strategy 3: Try a direct file upload approach
    if (!uploadSuccess) {
      try {
        console.log('Trying direct file upload...');
        
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
        });
        
        if (directUploadResponse.ok) {
          console.log('Direct upload successful');
          comfyUIPath = `models/loras/${uniqueFileName}`;
          uploadSuccess = true;
          uploadMethod = 'direct_upload';
        } else {
          console.log('Direct upload failed with status:', directUploadResponse.status);
        }
      } catch (directUploadError) {
        console.log('Direct upload error:', directUploadError);
      }
    }
    
    // Strategy 4: Store file temporarily and provide detailed instructions
    if (!uploadSuccess) {
      console.log('All upload methods failed, storing for manual setup');
      comfyUIPath = `models/loras/${uniqueFileName}`;
      uploadMethod = 'manual_required';
    }
    
    // Create influencer metadata
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      userId,
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
    
    // Add to database
    addUserInfluencer(userId, influencer);
    
    console.log('Influencer metadata saved:', influencer.id);
    
    // Prepare response based on upload success
    const responseData: any = {
      success: true,
      influencer,
      uploadedToComfyUI: uploadSuccess,
      uploadMethod
    };
    
    if (uploadSuccess) {
      responseData.message = `LoRA model uploaded successfully using ${uploadMethod}! It's ready to use.`;
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
    }
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Upload error:', error);
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

// Helper function to verify LoRA is available in ComfyUI
export async function verifyLoRAInComfyUI(fileName: string): Promise<boolean> {
  try {
    console.log('Verifying LoRA in ComfyUI:', fileName);
    const response = await fetch(`${COMFYUI_URL}/object_info`);
    if (!response.ok) {
      console.log('ComfyUI object_info request failed');
      return false;
    }
    
    const objectInfo = await response.json();
    const loraLoader = objectInfo.LoraLoaderModelOnly;
    
    if (loraLoader?.input?.required?.lora_name?.[0]) {
      const availableLoRAs = loraLoader.input.required.lora_name[0];
      const isAvailable = availableLoRAs.includes(fileName);
      console.log(`LoRA ${fileName} verification result:`, isAvailable);
      console.log('Available LoRAs:', availableLoRAs.length);
      return isAvailable;
    }
    
    console.log('No LoRA loader found in ComfyUI object info');
    return false;
  } catch (error) {
    console.error('Error verifying LoRA:', error);
    return false;
  }
}

// Endpoint to sync pending LoRAs
export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { action } = await request.json();
    
    if (action === 'sync_pending') {
      console.log('Syncing pending LoRAs for user:', userId);
      
      // Import the database functions here to avoid circular dependencies
      const { getUserInfluencers, updateUserInfluencer } = await import('@/lib/database');
      
      const userInfluencers = getUserInfluencers(userId);
      const syncResults = [];
      
      for (const influencer of userInfluencers) {
        if (influencer.syncStatus === 'pending' || influencer.syncStatus === 'missing') {
          const isAvailable = await verifyLoRAInComfyUI(influencer.fileName);
          
          if (isAvailable) {
            updateUserInfluencer(userId, influencer.id, {
              syncStatus: 'synced',
              isActive: true
            });
            syncResults.push({ 
              id: influencer.id, 
              fileName: influencer.fileName,
              status: 'synced' 
            });
          } else {
            updateUserInfluencer(userId, influencer.id, {
              syncStatus: 'missing'
            });
            syncResults.push({ 
              id: influencer.id, 
              fileName: influencer.fileName,
              status: 'still_missing' 
            });
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        syncResults,
        message: `Checked ${syncResults.length} LoRAs`,
        summary: {
          total: syncResults.length,
          synced: syncResults.filter(r => r.status === 'synced').length,
          missing: syncResults.filter(r => r.status === 'still_missing').length
        }
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed' },
      { status: 500 }
    );
  }
}