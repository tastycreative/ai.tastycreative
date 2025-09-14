import { NextRequest, NextResponse } from 'next/server';
import { CloudinaryService } from '@/lib/cloudinaryService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Training images upload endpoint called');
    
    // Get the form data from the request
    const formData = await request.formData();
    const imageFiles = formData.getAll('images') as File[];
    
    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json(
        { error: 'No image files provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 Received ${imageFiles.length} training images`);
    
    // Prepare images for Cloudinary upload
    const imagesToUpload: Array<{
      buffer: Buffer;
      filename: string;
      caption: string;
      originalType: string;
    }> = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      
      console.log(`📷 Processing image ${i + 1}/${imageFiles.length}:`, {
        name: imageFile.name,
        size: imageFile.size,
        type: imageFile.type
      });
      
      // Convert File to Buffer
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      imagesToUpload.push({
        buffer,
        filename: imageFile.name,
        caption: `Training image ${i + 1}`,
        originalType: imageFile.type,
      });
    }
    
    console.log(`📤 Uploading ${imagesToUpload.length} images to Cloudinary...`);
    
    // Upload all images to Cloudinary
    const uploadedImages = await CloudinaryService.uploadMultipleImages(
      imagesToUpload,
      {
        folder: 'training-images',
        transformation: {
          quality: 'auto',
          fetch_format: 'auto',
        }
      }
    );
    
    console.log(`✅ Successfully uploaded ${uploadedImages.length} images to Cloudinary`);
    
    // Format response with Cloudinary URLs and metadata
    const processedImages = uploadedImages.map((img, index) => ({
      originalName: img.originalFilename,
      filename: img.originalFilename,
      size: img.bytes,
      type: imagesToUpload[index].originalType,
      cloudinaryUrl: img.cloudinaryUrl,
      cloudinaryPublicId: img.cloudinaryPublicId,
      url: img.cloudinaryUrl, // For compatibility
      width: img.width,
      height: img.height,
      caption: img.caption,
    }));
    
    return NextResponse.json({
      success: true,
      count: processedImages.length,
      images: processedImages
    });
    
  } catch (error) {
    console.error('❌ Training images upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload training images' },
      { status: 500 }
    );
  }
}// Configure the body size limit for this route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for multiple file uploads