// app/api/upload/image/route.ts - Using ComfyUI's upload API
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15833';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('=== IMAGE UPLOAD REQUEST (ComfyUI API) ===');
    console.log('Upload for user:', clerkId);
    console.log('ComfyUI URL:', COMFYUI_URL);

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const maskFile = formData.get('mask') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    console.log('📁 File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      hasMask: !!maskFile
    });

    // Validate file type and size
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: ' + ALLOWED_TYPES.join(', ')
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      }, { status: 400 });
    }

    // Upload main image to ComfyUI
    const uploadFormData = new FormData();
    
    // Generate a clean filename
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const cleanName = file.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9._-]/g, '');
    
    const filename = `${uniqueId}_${timestamp}_${cleanName}`;
    
    // Create a new File object with the clean filename
    const renamedFile = new File([file], filename, { type: file.type });
    uploadFormData.append('image', renamedFile);
    
    console.log('📤 Uploading to ComfyUI:', filename);

    try {
      // Add authentication for RunPod/ComfyUI server
      const headers: Record<string, string> = {};
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (runpodApiKey) {
        headers['Authorization'] = `Bearer ${runpodApiKey}`;
      }

      // Upload to ComfyUI's /upload/image endpoint
      const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
        method: 'POST',
        body: uploadFormData,
        headers,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      console.log('📡 ComfyUI upload response:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ ComfyUI upload failed:', errorText);
        throw new Error(`ComfyUI upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('✅ ComfyUI upload result:', uploadResult);

      // Extract the actual filename used by ComfyUI
      const comfyUIFilename = uploadResult.name || uploadResult.filename || filename;

      let maskFilename: string | undefined;

      // Upload mask if present
      if (maskFile) {
        const maskCleanName = maskFile.name
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9._-]/g, '');
        
        const maskName = `${uniqueId}_${timestamp}_mask_${maskCleanName}`;
        
        const maskFormData = new FormData();
        const renamedMask = new File([maskFile], maskName, { type: maskFile.type });
        maskFormData.append('image', renamedMask);

        try {
          const maskUploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
            method: 'POST',
            body: maskFormData,
            headers,
            signal: AbortSignal.timeout(30000)
          });

          if (maskUploadResponse.ok) {
            const maskResult = await maskUploadResponse.json();
            maskFilename = maskResult.name || maskResult.filename || maskName;
            console.log('✅ Mask uploaded:', maskFilename);
          } else {
            console.error('❌ Mask upload failed');
          }
        } catch (maskError) {
          console.error('⚠️ Mask upload error:', maskError);
        }
      }

      const response = {
        success: true,
        filename: comfyUIFilename,
        maskFilename,
        originalName: file.name,
        size: file.size,
        hasMask: !!maskFile,
        uploadMethod: 'comfyui_api',
        comfyUIResponse: uploadResult,
        message: 'Files uploaded directly to ComfyUI'
      };

      console.log('✅ Upload completed via ComfyUI API:', {
        filename: comfyUIFilename,
        maskFilename,
        method: 'comfyui_api'
      });

      return NextResponse.json(response);

    } catch (uploadError) {
      console.error('💥 ComfyUI upload error:', uploadError);
      
      // Fallback error response
      return NextResponse.json({
        error: 'Failed to upload to ComfyUI',
        details: uploadError instanceof Error ? uploadError.message : 'Unknown error',
        comfyUIUrl: COMFYUI_URL
      }, { status: 500 });
    }

  } catch (error) {
    console.error('💥 Upload error:', error);
    return NextResponse.json({
      error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}