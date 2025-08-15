// app/api/user/influencers/transfer-to-comfyui/route.ts - Transfer from Blob to ComfyUI
import { NextRequest, NextResponse } from 'next/server';
import { getUserId, updateUserInfluencer } from '@/lib/database';

// Configure for Vercel deployment
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file transfer
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
    
    const { influencerId, blobUrl, fileName } = await request.json();
    
    console.log('🔄 === BLOB TO COMFYUI TRANSFER ===');
    console.log('👤 User:', userId);
    console.log('📁 File:', fileName);
    console.log('🔗 Blob URL:', blobUrl);
    console.log('🆔 Influencer ID:', influencerId);
    
    if (!influencerId || !blobUrl || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Step 1: Download file from Vercel Blob
    console.log('📥 Step 1: Downloading file from Vercel Blob...');
    let fileBuffer: ArrayBuffer;
    
    try {
      const blobResponse = await fetch(blobUrl, {
        signal: AbortSignal.timeout(120000) // 2 minute timeout for download
      });
      
      if (!blobResponse.ok) {
        throw new Error(`Failed to download from blob: ${blobResponse.status}`);
      }
      
      fileBuffer = await blobResponse.arrayBuffer();
      console.log(`✅ Downloaded file from blob (${fileBuffer.byteLength} bytes)`);
    } catch (downloadError) {
      console.error('❌ Failed to download from blob:', downloadError);
      
      // Update influencer status to error
      try {
        await updateUserInfluencer(userId, influencerId, {
          syncStatus: 'error',
          isActive: false
        });
      } catch (dbError) {
        console.error('❌ Failed to update influencer status:', dbError);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to download file from blob storage',
          details: downloadError instanceof Error ? downloadError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
    // Step 2: Upload file to ComfyUI
    console.log('🚀 Step 2: Uploading file to ComfyUI...');
    let uploadedToComfyUI = false;
    
    try {
      const uploadSuccess = await uploadBufferToComfyUI(fileBuffer, fileName);
      if (uploadSuccess) {
        uploadedToComfyUI = true;
        console.log('✅ Successfully uploaded to ComfyUI');
      } else {
        throw new Error('ComfyUI upload failed');
      }
    } catch (comfyError) {
      console.error('❌ ComfyUI upload failed:', comfyError);
      
      // Update influencer status to error
      try {
        await updateUserInfluencer(userId, influencerId, {
          syncStatus: 'error',
          isActive: false
        });
      } catch (dbError) {
        console.error('❌ Failed to update influencer status:', dbError);
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to upload to ComfyUI',
          details: comfyError instanceof Error ? comfyError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
    // Step 3: Update influencer status to synced
    console.log('💾 Step 3: Updating influencer status...');
    
    try {
      await updateUserInfluencer(userId, influencerId, {
        syncStatus: 'synced',
        isActive: true,
        comfyUIPath: `models/loras/${fileName}`
      });
      console.log('✅ Influencer status updated to synced');
    } catch (dbError) {
      console.error('❌ Failed to update influencer status:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to update database' },
        { status: 500 }
      );
    }
    
    console.log('🎉 Transfer completed successfully!');
    
    return NextResponse.json({
      success: true,
      message: 'File successfully transferred to ComfyUI and is ready for use!',
      uploadedToComfyUI: true,
      syncStatus: 'synced',
      comfyUIPath: `models/loras/${fileName}`
    });
    
  } catch (error) {
    console.error('💥 Transfer error:', error);
    return NextResponse.json({
      success: false,
      error: 'Transfer failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to upload buffer to ComfyUI
async function uploadBufferToComfyUI(fileBuffer: ArrayBuffer, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`📡 Uploading to ComfyUI: ${fileName} (${fileBuffer.byteLength} bytes)`);
    
    // Prepare form data for ComfyUI
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('image', blob, fileName);
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    console.log(`📤 Uploading to ComfyUI: ${COMFYUI_URL}/upload/image`);
    
    // Upload to ComfyUI with timeout
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(180000) // 3 minute timeout for large files
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Successfully uploaded to ComfyUI');
      try {
        const responseText = await uploadResponse.text();
        console.log('📝 ComfyUI response:', responseText);
      } catch (e) {
        console.log('📝 ComfyUI response: (unable to read response body)');
      }
      return true;
    } else {
      console.error('❌ ComfyUI upload failed:', uploadResponse.status, uploadResponse.statusText);
      try {
        const responseText = await uploadResponse.text();
        console.error('❌ ComfyUI error response:', responseText);
      } catch (e) {
        console.error('❌ ComfyUI error: (unable to read error response)');
      }
      return false;
    }
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ ComfyUI upload timeout');
    } else {
      console.error('❌ Error in uploadBufferToComfyUI:', error);
    }
    return false;
  }
}
