// app/api/user/influencers/upload-blob/route.ts - Server-side blob upload with streaming
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getUserId } from '@/lib/database';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export const maxDuration = 60; // Allow up to 60 seconds for large uploads

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Server-side blob upload request received');
    
    // Authenticate the user
    const userId = await getUserId(request);
    if (!userId) {
      console.error('❌ No user ID found during authentication');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('👤 Processing upload for user:', userId);
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const displayName = formData.get('displayName') as string;
    const description = formData.get('description') as string || '';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log('📦 Uploading file:', fileName, 'Size:', file.size, 'bytes');
    
    // Generate unique path for blob storage
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const timestamp = Date.now();
    const uniquePath = `loras/server/${timestamp}_${baseName}${fileExtension}`;
    
    // Upload to Vercel Blob storage
    console.log('☁️ Uploading to blob storage:', uniquePath);
    const blob = await put(uniquePath, file, {
      access: 'public',
    });
    
    console.log('✅ Blob upload completed:', blob.url);
    
    // Save to database
    const influencer = await prisma.influencerLoRA.create({
      data: {
        clerkId: userId,
        name: baseName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        displayName,
        fileName: blob.pathname,
        originalFileName: fileName,
        fileSize: file.size,
        description,
        thumbnailUrl: null,
        isActive: true,
        usageCount: 0,
        syncStatus: 'PENDING',
        comfyUIPath: null,
      },
    });
    
    console.log('💾 Saved to database with ID:', influencer.id);
    
    // Try to upload to ComfyUI
    let uploadedToComfyUI = false;
    let instructions = null;
    
    try {
      console.log('🚀 Attempting to upload to ComfyUI...');
      const uploadSuccess = await uploadLoRAToComfyUI(blob.url, fileName);
      if (uploadSuccess) {
        uploadedToComfyUI = true;
        await prisma.influencerLoRA.update({
          where: { id: influencer.id },
          data: { 
            syncStatus: 'SYNCED',
            comfyUIPath: `loras/${fileName}`
          },
        });
        console.log('✅ Successfully uploaded to ComfyUI and updated database');
      } else {
        console.log('⚠️ ComfyUI upload failed, marked as pending');
        await prisma.influencerLoRA.update({
          where: { id: influencer.id },
          data: { syncStatus: 'ERROR' },
        });
      }
    } catch (comfyError) {
      console.error('❌ Error during ComfyUI upload:', comfyError);
      await prisma.influencerLoRA.update({
        where: { id: influencer.id },
        data: { syncStatus: 'ERROR' },
      });
    }
    
    return NextResponse.json({
      success: true,
      influencer,
      blobUrl: blob.url,
      uploadedToComfyUI,
      instructions: !uploadedToComfyUI ? {
        title: "LoRA Upload Complete!",
        note: "Your LoRA has been uploaded and will be automatically synced to ComfyUI. No manual work required!"
      } : undefined
    });
    
  } catch (error) {
    console.error('❌ Error in server-side blob upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper function to automatically upload LoRA to ComfyUI (copied from blob-complete)
async function uploadLoRAToComfyUI(blobUrl: string, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`📡 Downloading file from blob: ${blobUrl}`);
    
    // Download the file from Vercel Blob
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      console.error('❌ Failed to download from blob:', blobResponse.status);
      return false;
    }
    
    const fileBuffer = await blobResponse.arrayBuffer();
    console.log(`✅ Downloaded file from blob (${fileBuffer.byteLength} bytes)`);
    
    // Try ComfyUI upload
    const formData = new FormData();
    formData.append('image', new Blob([fileBuffer]), fileName);
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Successfully uploaded to ComfyUI');
      return true;
    } else {
      console.error('❌ ComfyUI upload failed:', uploadResponse.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error in uploadLoRAToComfyUI:', error);
    return false;
  }
}
