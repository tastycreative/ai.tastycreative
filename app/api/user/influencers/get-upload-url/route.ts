// app/api/user/influencers/get-upload-url/route.ts - Get signed URL for client-side blob upload
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

// Configure for Vercel deployment
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    console.log('🔗 === GET UPLOAD URL ===');
    console.log('👤 Getting upload URL for user:', userId);
    
    const { fileName, fileSize, displayName, description } = await request.json();
    
    console.log('📋 Upload URL request:', {
      fileName,
      fileSize,
      displayName,
      description: !!description
    });
    
    if (!fileName || !fileSize) {
      return NextResponse.json(
        { success: false, error: 'Missing fileName or fileSize' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const validExtensions = ['.safetensors', '.pt', '.ckpt'];
    const isValidFile = validExtensions.some(ext => 
      fileName.toLowerCase().endsWith(ext)
    );
    
    if (!isValidFile) {
      console.error('❌ Invalid file type:', fileName);
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload .safetensors, .pt, or .ckpt files.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename and influencer ID
    const timestamp = Date.now();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;
    const influencerId = uuidv4();
    
    console.log('📁 Generated unique filename:', uniqueFileName);
    console.log('🆔 Generated influencer ID:', influencerId);
    
    // Create influencer record in database with pending status
    const influencer: InfluencerLoRA = {
      id: influencerId,
      clerkId: userId,
      name: baseName,
      displayName: displayName || baseName,
      fileName: uniqueFileName,
      originalFileName: fileName,
      fileSize: fileSize,
      uploadedAt: new Date().toISOString(),
      description: description || `LoRA model uploaded from ${fileName}`,
      thumbnailUrl: undefined,
      isActive: false,
      usageCount: 0,
      syncStatus: 'pending',
      lastUsedAt: undefined,
      comfyUIPath: undefined
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
    
    // For large files, we'll use a simple approach:
    // Return the influencer ID and let the client upload directly via our chunked upload endpoint
    const blobPath = `loras/${userId}/${uniqueFileName}`;
    
    console.log('✅ Generated upload configuration for chunked upload');
    
    return NextResponse.json({
      success: true,
      influencerId: influencerId,
      fileName: uniqueFileName,
      uploadEndpoint: '/api/user/influencers/chunked-upload',
      message: 'Upload configuration ready. Use chunked upload for large files.'
    });
    
  } catch (error) {
    console.error('💥 Get upload URL error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate upload URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
