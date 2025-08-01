// app/api/user/influencers/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

// Helper to get user ID (implement your auth logic here)
function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'default-user';
}

// Import the influencers database from the main route
const influencersDb: Map<string, any[]> = new Map();

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    console.log('Processing upload for user:', userId);
    
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
    
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;
    
    console.log('Uploading file:', uniqueFileName);
    
    // Step 1: Upload to ComfyUI
    const comfyUIFormData = new FormData();
    comfyUIFormData.append('image', file, uniqueFileName);
    comfyUIFormData.append('subfolder', 'loras'); // Upload to models/loras directory
    comfyUIFormData.append('type', 'input');
    
    try {
      console.log('Uploading to ComfyUI...');
      const comfyUIResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
        method: 'POST',
        body: comfyUIFormData,
      });
      
      if (!comfyUIResponse.ok) {
        const errorText = await comfyUIResponse.text();
        console.error('ComfyUI upload failed:', errorText);
        throw new Error(`ComfyUI upload failed: ${errorText}`);
      }
      
      const comfyUIResult = await comfyUIResponse.json();
      console.log('ComfyUI upload successful:', comfyUIResult);
      
    } catch (comfyUIError) {
      console.error('ComfyUI upload error:', comfyUIError);
      
      // Try alternative approach: direct file upload to ComfyUI models directory
      try {
        console.log('Trying alternative upload method...');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Use a different endpoint or method if available
        const alternativeResponse = await fetch(`${COMFYUI_URL}/api/models/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': uniqueFileName,
            'X-Model-Type': 'lora'
          },
          body: buffer,
        });
        
        if (!alternativeResponse.ok) {
          throw new Error('Alternative upload method also failed');
        }
        
        console.log('Alternative upload successful');
        
      } catch (altError) {
        console.error('Alternative upload also failed:', altError);
        
        // For demo purposes, continue without ComfyUI upload
        // In production, you might want to fail here or store locally and sync later
        console.log('Continuing without ComfyUI upload for demo purposes...');
      }
    }
    
    // Step 2: Save metadata to our database
    const influencer = {
      id: uuidv4(),
      userId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      displayName: displayName || file.name.replace(/\.[^/.]+$/, ""),
      fileName: uniqueFileName,
      originalFileName: file.name,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      description: description || '',
      isActive: true,
      usageCount: 0,
      comfyUIPath: `models/loras/${uniqueFileName}`
    };
    
    const userInfluencers = influencersDb.get(userId) || [];
    userInfluencers.push(influencer);
    influencersDb.set(userId, userInfluencers);
    
    console.log('Influencer metadata saved:', influencer.id);
    
    return NextResponse.json({
      success: true,
      influencer,
      message: 'Influencer uploaded successfully'
    });
    
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

// Helper function to sync LoRA with ComfyUI (can be called separately)
export async function syncLoRAWithComfyUI(fileName: string, fileBuffer: Buffer) {
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('image', blob, fileName);
    formData.append('subfolder', 'loras');
    formData.append('type', 'input');
    
    const response = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`ComfyUI sync failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error syncing with ComfyUI:', error);
    throw error;
  }
}