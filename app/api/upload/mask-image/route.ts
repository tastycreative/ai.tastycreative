// app/api/upload/mask-image/route.ts - Upload target image WITH mask combined
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15833';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    console.log('🎭 === MASKED IMAGE UPLOAD REQUEST ===');
    
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      console.log('❌ No authenticated user found');
      return NextResponse.json({ 
        success: false,
        error: 'Authentication required' 
      }, { status: 401 });
    }

    console.log('👤 Uploading masked image for user:', clerkId);
    console.log('🖥️ ComfyUI URL:', COMFYUI_URL);

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }

    const { imageDataUrl, maskDataUrl, originalImageName } = requestBody;

    if (!imageDataUrl || !maskDataUrl) {
      console.error('❌ Missing image or mask data');
      return NextResponse.json({ 
        success: false,
        error: 'Both image and mask data are required' 
      }, { status: 400 });
    }

    // Validate data URL formats
    if (!imageDataUrl.startsWith('data:image/') || !maskDataUrl.startsWith('data:image/')) {
      console.error('❌ Invalid data format');
      return NextResponse.json({ 
        success: false,
        error: 'Invalid image or mask data format' 
      }, { status: 400 });
    }

    console.log('🎯 Combining image with face mask...');
    console.log('  - Original image:', originalImageName || 'unknown');

    try {
      // Create canvas to combine image and mask
      const canvas = new OffscreenCanvas(512, 512);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not create canvas context');
      }

      // Load original image
      const [, imageBase64] = imageDataUrl.split(',');
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const imageBlob = new Blob([imageBuffer]);
      const imageBitmap = await createImageBitmap(imageBlob);
      
      // Load mask
      const [, maskBase64] = maskDataUrl.split(',');
      const maskBuffer = Buffer.from(maskBase64, 'base64');
      const maskBlob = new Blob([maskBuffer]);
      const maskBitmap = await createImageBitmap(maskBlob);

      // Set canvas size to match image
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;

      // Draw original image
      ctx.drawImage(imageBitmap, 0, 0);

      // Get image data to combine with mask
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Draw mask to get mask data
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(maskBitmap, 0, 0, canvas.width, canvas.height);
      const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Combine image with mask as alpha channel
      for (let i = 0; i < imageData.data.length; i += 4) {
        const maskAlpha = maskData.data[i]; // Use red channel of mask as alpha
        imageData.data[i + 3] = maskAlpha > 128 ? 255 : 0; // Binary mask
      }

      // Put combined data back on canvas
      ctx.putImageData(imageData, 0, 0);

      // Convert to blob
      const combinedBlob = await canvas.convertToBlob({ type: 'image/png' });
      const combinedBuffer = await combinedBlob.arrayBuffer();

      if (combinedBuffer.byteLength > MAX_FILE_SIZE) {
        console.error('❌ Combined image too large:', combinedBuffer.byteLength, 'bytes');
        return NextResponse.json({
          success: false,
          error: `Combined image too large: ${Math.round(combinedBuffer.byteLength / 1024 / 1024)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`
        }, { status: 400 });
      }

      // Generate filename
      const timestamp = Date.now();
      const uniqueId = uuidv4().substring(0, 8);
      let baseName = 'image';
      if (originalImageName) {
        baseName = originalImageName
          .replace(/\.[^/.]+$/, "")
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9._-]/g, '');
      }
      
      const filename = `${uniqueId}_${timestamp}_${baseName}_masked.png`;
      
      console.log('📁 Generated filename:', filename);
      console.log('📊 Combined image size:', Math.round(combinedBuffer.byteLength / 1024), 'KB');

      // Create FormData for ComfyUI upload
      const formData = new FormData();
      const file = new File([combinedBuffer], filename, { 
        type: 'image/png',
        lastModified: Date.now()
      });
      
      formData.append('image', file);

      console.log('📤 Uploading masked image to ComfyUI...');

      // Upload to ComfyUI
      const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30000)
      });

      console.log('📡 ComfyUI upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        let errorText = '';
        try {
          errorText = await uploadResponse.text();
        } catch (textError) {
          errorText = 'Unable to read error response';
        }
        
        console.error('❌ ComfyUI upload failed:');
        console.error('  - Status:', uploadResponse.status, uploadResponse.statusText);
        console.error('  - Error text:', errorText.substring(0, 500));
        
        throw new Error(`ComfyUI upload failed: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }

      let uploadResult;
      try {
        uploadResult = await uploadResponse.json();
      } catch (jsonError) {
        console.error('❌ Failed to parse ComfyUI JSON response:', jsonError);
        throw new Error('Invalid JSON response from ComfyUI');
      }

      console.log('✅ ComfyUI upload result:', uploadResult);

      const comfyUIFilename = uploadResult.name || uploadResult.filename || filename;
      
      if (!comfyUIFilename) {
        console.error('❌ No filename returned from ComfyUI:', uploadResult);
        throw new Error('ComfyUI did not return a valid filename');
      }

      const response = {
        success: true,
        filename: comfyUIFilename,
        originalFilename: filename,
        uploadMethod: 'comfyui_masked_image',
        size: combinedBuffer.byteLength,
        sizeFormatted: `${Math.round(combinedBuffer.byteLength / 1024)}KB`,
        message: 'Masked image uploaded successfully to ComfyUI',
        comfyUIResponse: uploadResult,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Masked image upload completed successfully:');
      console.log('  - ComfyUI filename:', comfyUIFilename);
      console.log('  - Size:', Math.round(combinedBuffer.byteLength / 1024), 'KB');
      console.log('🎭 === MASKED IMAGE UPLOAD SUCCESS ===');

      return NextResponse.json(response);

    } catch (processingError) {
      console.error('💥 Image processing error:', processingError);
      
      let errorDetails = 'Unknown processing error';
      if (processingError instanceof Error) {
        errorDetails = processingError.message;
        
        if (processingError.stack) {
          console.error('🔍 Error stack trace:', processingError.stack.split('\n').slice(0, 5));
        }
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to process masked image',
        details: errorDetails,
        comfyUIUrl: COMFYUI_URL,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('💥 === CRITICAL ERROR in masked image upload ===');
    console.error('Error details:', error);
    
    if (error instanceof Error) {
      console.error('🔍 Error breakdown:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Masked image upload failed',
      details: error instanceof Error ? error.message : 'Unknown server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET method for health check
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Masked image upload API is ready',
      comfyUIUrl: COMFYUI_URL,
      maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
      supportedFormats: ['image/png with alpha mask'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}