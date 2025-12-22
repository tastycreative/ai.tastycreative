import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const displayName = formData.get('displayName') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!displayName) {
      return NextResponse.json({ error: 'No display name provided' }, { status: 400 });
    }

    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .safetensors, .pt, and .ckpt files are allowed.' 
      }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${userId}_${timestamp}_${file.name}`;

    console.log(`🎯 Uploading LoRA: ${uniqueFileName}`);
    console.log(`📁 File size: ${Math.round(file.size / 1024 / 1024)}MB`);

    // Upload directly to ComfyUI models/loras directory with user subfolder
    const COMFYUI_URL = process.env.COMFYUI_URL;
    if (!COMFYUI_URL) {
      throw new Error('ComfyUI URL not configured');
    }

    console.log('📡 Uploading to ComfyUI models/loras...');

    // Create user-specific subdirectory for organization
    const userSubfolder = `loras/${userId}`;
    
    // Create FormData for ComfyUI upload
    const comfyUIFormData = new FormData();
    comfyUIFormData.append('image', file, uniqueFileName);
    comfyUIFormData.append('subfolder', userSubfolder);
    comfyUIFormData.append('type', 'input');

    // Upload to ComfyUI
    const comfyUIResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: comfyUIFormData,
    });

    if (!comfyUIResponse.ok) {
      const errorText = await comfyUIResponse.text();
      console.error('❌ ComfyUI upload failed:', comfyUIResponse.status, errorText);
      return NextResponse.json(
        { error: `Upload failed: ${comfyUIResponse.status}` },
        { status: 500 }
      );
    }

    let comfyUIResult;
    try {
      const contentType = comfyUIResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        comfyUIResult = await comfyUIResponse.json();
      } else {
        comfyUIResult = { message: await comfyUIResponse.text() };
      }
    } catch (parseError) {
      comfyUIResult = { message: 'Upload successful' };
    }
    
    console.log('✅ ComfyUI upload successful:', comfyUIResult);

    return NextResponse.json({
      success: true,
      fileName: uniqueFileName,
      comfyUIPath: `models/${userSubfolder}/${uniqueFileName}`,
      networkVolumePath: `/workspace/ComfyUI/models/${userSubfolder}/${uniqueFileName}`,
      message: 'LoRA uploaded to ComfyUI models directory',
      uploadLocation: 'comfyui_models',
      result: comfyUIResult
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
