// app/api/user/influencers/complete-upload/route.ts - Complete Upload Process
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }

    const { fileName, displayName, fileSize, uploadMethod } = await request.json();

    console.log('🎯 Completing upload process for:', fileName);

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;

    // Create influencer metadata
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      clerkId: userId,
      name: baseName,
      displayName: displayName || baseName,
      fileName: uniqueFileName,
      originalFileName: fileName,
      fileSize: fileSize || 0,
      uploadedAt: new Date().toISOString(),
      description: `LoRA model uploaded via ${uploadMethod}`,
      thumbnailUrl: undefined,
      isActive: true,
      usageCount: 0,
      syncStatus: 'synced',
      lastUsedAt: undefined,
      comfyUIPath: `models/loras/${uniqueFileName}`
    };

    // Save to database
    await addUserInfluencer(userId, influencer);
    console.log('✅ Influencer record created successfully');

    return NextResponse.json({
      success: true,
      message: 'Upload completed successfully',
      influencer: {
        id: influencer.id,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        fileSize: influencer.fileSize,
        isActive: influencer.isActive,
        syncStatus: influencer.syncStatus
      }
    });

  } catch (error) {
    console.error('💥 Complete upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to complete upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
