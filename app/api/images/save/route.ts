import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveImageToDatabase } from '@/lib/imageStorage';
import { prisma } from '@/lib/database';
import { z } from 'zod';

// Validation schema for chunked image save requests
const saveImageSchema = z.object({
  jobId: z.string().min(1),
  filename: z.string().min(1),
  subfolder: z.string().default(''),
  type: z.string().default('output'),
  data: z.string().min(1), // Base64 image data
  s3Key: z.string().optional(), // S3 key if provided
  networkVolumePath: z.string().optional(), // Network volume path if provided
  fileSize: z.number().optional(), // File size if provided
});

/**
 * POST /api/images/save
 * 
 * This route handles chunked image delivery from frontend components.
 * It saves images to the database with proper S3 optimization when S3 keys are provided.
 * 
 * Used by:
 * - Text-to-image frontend for chunked delivery
 * - Style transfer frontend for chunked delivery  
 * - Skin enhancer frontend for chunked delivery
 */
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = saveImageSchema.parse(body);

    console.log('💾 Image save request received:', {
      jobId: validatedData.jobId,
      filename: validatedData.filename,
      hasS3Key: !!validatedData.s3Key,
      hasNetworkVolumePath: !!validatedData.networkVolumePath,
      dataSize: validatedData.data.length
    });

    // Extract base64 data (remove data:image/png;base64, prefix if present)
    const base64Data = validatedData.data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    console.log(`📊 Processing chunked image: ${validatedData.filename}, size: ${imageBuffer.length} bytes`);

    // Check if this image already exists with S3 optimization (from webhook)
    let existingImage = null;
    try {
      existingImage = await prisma.generatedImage.findFirst({
        where: {
          jobId: validatedData.jobId,
          filename: validatedData.filename,
          subfolder: validatedData.subfolder,
          type: validatedData.type
        }
      });
    } catch (error) {
      console.log('⚠️ Could not check for existing image:', error);
    }

    // If image already exists with S3 key, don't save blob data (avoid duplication)
    if (existingImage && existingImage.s3Key) {
      console.log('✅ Image already exists with S3 optimization, skipping blob storage');
      console.log(`   Existing S3 key: ${existingImage.s3Key}`);
      
      return NextResponse.json({
        success: true,
        message: 'Image already optimized with S3 storage',
        image: {
          id: existingImage.id,
          filename: existingImage.filename,
          dataUrl: existingImage.data ? `/api/images/${existingImage.id}/data` : undefined,
          url: `/api/images/${existingImage.id}/network-volume`,
          s3Key: existingImage.s3Key
        }
      });
    }

    // Prepare save options - prioritize S3 optimization
    const saveOptions: any = {
      extractMetadata: true,
      providedData: imageBuffer
    };

    // If S3 key is provided, don't save blob data (S3 optimization)
    if (validatedData.s3Key) {
      console.log('📤 S3 key provided - using S3 optimization:', validatedData.s3Key);
      saveOptions.saveData = false; // Don't save blob data to database
      saveOptions.s3Key = validatedData.s3Key;
      
      if (validatedData.networkVolumePath) {
        saveOptions.networkVolumePath = validatedData.networkVolumePath;
        console.log('💾 Network volume path provided:', validatedData.networkVolumePath);
      }
      
      if (validatedData.fileSize) {
        saveOptions.fileSize = validatedData.fileSize;
        console.log('📏 File size provided:', validatedData.fileSize);
      }
    } else {
      // Fallback: save blob data to database (legacy behavior)
      console.log('⚠️ No S3 key provided - saving blob data to database (legacy mode)');
      saveOptions.saveData = true;
    }

    // Save image to database
    const imageRecord = await saveImageToDatabase(
      userId,
      validatedData.jobId,
      {
        filename: validatedData.filename,
        subfolder: validatedData.subfolder,
        type: validatedData.type
      },
      saveOptions
    );

    if (!imageRecord) {
      console.error('❌ Failed to save image to database:', validatedData.filename);
      return NextResponse.json(
        { error: 'Failed to save image to database' },
        { status: 500 }
      );
    }

    console.log('✅ Chunked image saved successfully:', {
      id: imageRecord.id,
      filename: imageRecord.filename,
      hasS3Key: !!imageRecord.s3Key,
      hasDataUrl: !!imageRecord.dataUrl,
      hasUrl: !!imageRecord.url
    });

    // Return success response with image record
    return NextResponse.json({
      success: true,
      message: 'Image saved successfully',
      image: {
        id: imageRecord.id,
        filename: imageRecord.filename,
        dataUrl: imageRecord.dataUrl,
        url: imageRecord.url,
        s3Key: imageRecord.s3Key
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error in image save:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    console.error('❌ Error saving chunked image:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}