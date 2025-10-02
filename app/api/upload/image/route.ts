import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { trackApiUsage } from '@/lib/bandwidthMonitor';
import { optimizeImageBuffer, formatBytes } from '@/lib/imageOptimization';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Image upload endpoint called');
    
    // Get the form data from the request
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const maskFile = formData.get('mask') as File | null;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    console.log('📁 Received image:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    });
    
    if (maskFile) {
      console.log('🎭 Received mask:', {
        name: maskFile.name,
        size: maskFile.size,
        type: maskFile.type
      });
    }
    
    // Convert File to Buffer
    const bytes = await imageFile.arrayBuffer();
    let buffer = Buffer.from(bytes);
    
    // Optimize image to reduce bandwidth and storage
    const originalSize = buffer.length;
    if (originalSize > 100 * 1024) { // Optimize images > 100KB
      console.log('🗜️ Optimizing uploaded image. Original size:', formatBytes(originalSize));
      
      try {
        const optimizedBuffer = await optimizeImageBuffer(buffer, {
          quality: 85,
          maxWidth: 2048,
          maxHeight: 2048,
          format: 'jpeg'
        });
        buffer = Buffer.from(optimizedBuffer);
        
        const optimizedSize = buffer.length;
        const reductionPercent = Math.round(((originalSize - optimizedSize) / originalSize) * 100);
        console.log('✅ Image optimized:', formatBytes(originalSize), '→', formatBytes(optimizedSize), `(${reductionPercent}% reduction)`);
      } catch (optimizationError) {
        console.warn('⚠️ Image optimization failed, using original:', optimizationError);
      }
    }
    
    // Create a unique filename
    const timestamp = Date.now();
    const originalName = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const extension = imageFile.name.split('.').pop() || 'jpg';
    const filename = `${originalName}_${timestamp}.${extension}`;
    
    // Use /tmp directory for Vercel serverless compatibility
    const uploadDir = '/tmp/uploads';
    
    try {
      // Ensure directory exists
      const { mkdir } = await import('fs/promises');
      await mkdir(uploadDir, { recursive: true });
      
      // Write image file to temp directory
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);
      
      console.log('✅ Image saved to:', filePath);
      
      // Convert to base64 for immediate use (since /tmp files are ephemeral)
      const base64Data = buffer.toString('base64');
      const dataUrl = `data:${imageFile.type};base64,${base64Data}`;
      
      const response: any = {
        success: true,
        filename: filename,
        size: imageFile.size,
        type: imageFile.type,
        filePath: filePath, // Temp file path for server-side use
        // Include base64 data for image-to-video generation
        base64: base64Data, // Required for RunPod image-to-video handler
        dataUrl: dataUrl    // Required for frontend preview
      };
      
      // Handle mask file if provided
      if (maskFile) {
        const maskBytes = await maskFile.arrayBuffer();
        const maskBuffer = Buffer.from(maskBytes);
        
        const maskExtension = maskFile.name.split('.').pop() || 'png';
        const maskFilename = `${originalName}_mask_${timestamp}.${maskExtension}`;
        const maskFilePath = path.join(uploadDir, maskFilename);
        
        await writeFile(maskFilePath, maskBuffer);
        console.log('✅ Mask saved to:', maskFilePath);
        
        // Convert mask to base64 for server-side use only
        const maskBase64Data = maskBuffer.toString('base64');
        const maskDataUrl = `data:${maskFile.type};base64,${maskBase64Data}`;
        
        response.maskFilename = maskFilename;
        response.maskFilePath = maskFilePath;
        // Include mask base64 data for image-to-video generation
        response.maskBase64 = maskBase64Data;
        response.maskDataUrl = maskDataUrl;
      }
      
      // Track bandwidth usage for monitoring
      try {
        trackApiUsage('/api/upload/image', 
          { 
            imageSize: imageFile.size, 
            maskSize: maskFile?.size || 0 
          }, 
          response,
          { compressionRatio: 0 } // No compression applied, returning full base64 data needed for image-to-video
        );
      } catch (trackingError) {
        console.warn('⚠️ Bandwidth tracking failed:', trackingError);
      }
      
      return NextResponse.json(response);
      
    } catch (writeError) {
      console.error('❌ Error saving file:', writeError);
      return NextResponse.json(
        { error: 'Failed to save image file' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ Image upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// Configure the body size limit for this route
export const runtime = 'nodejs';
// export const maxDuration = 30; // 30 seconds max
