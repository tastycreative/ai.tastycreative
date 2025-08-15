// app/api/user/influencers/blob-complete/route.ts
// FIXED: Removed conflicting parent route.ts file to enable proper routing
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getUserId, addUserInfluencer, type InfluencerLoRA } from '@/lib/database';

// Add GET method for testing/debugging
export async function GET() {
  return NextResponse.json({ 
    message: "blob-complete endpoint is working",
    method: "GET",
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 === BLOB COMPLETE ENDPOINT CALLED ===');
    
    // Get user ID
    const userId = await getUserId(request);
    if (!userId) {
      console.error('❌ No user ID found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Invalid JSON in request body:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { blobUrl, fileName, displayName, description, fileSize } = body;
    
    // Validate required fields
    if (!blobUrl || !fileName) {
      console.error('❌ Missing required fields:', { blobUrl: !!blobUrl, fileName: !!fileName });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: blobUrl and fileName' },
        { status: 400 }
      );
    }
    
    console.log('🔍 === COMPLETING LORA UPLOAD ===');
    console.log('👤 User:', userId);
    console.log('📁 File:', fileName);
    console.log('🔗 Blob URL:', blobUrl);
    console.log('📊 File Size:', fileSize);
    console.log('🏷️ Display Name:', displayName);
    console.log('📝 Description:', description);
    
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
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const uniqueFileName = `${userId}_${timestamp}_${baseName}${fileExtension}`;
    
    console.log('🏷️ Generated unique filename:', uniqueFileName);
    
    // Upload to ComfyUI
    console.log('🚀 Attempting to upload to ComfyUI...');
    let uploadedToComfyUI = false;
    let comfyUIError: string | null = null;
    
    try {
      const uploadSuccess = await uploadLoRAToComfyUI(blobUrl, uniqueFileName);
      if (uploadSuccess) {
        uploadedToComfyUI = true;
        console.log('✅ Successfully uploaded to ComfyUI');
      } else {
        console.log('⚠️ Failed to upload to ComfyUI');
        comfyUIError = 'ComfyUI upload failed';
      }
    } catch (error) {
      console.error('❌ ComfyUI upload error:', error);
      comfyUIError = error instanceof Error ? error.message : 'Unknown ComfyUI error';
    }
    
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
      isActive: uploadedToComfyUI,
      usageCount: 0,
      syncStatus: uploadedToComfyUI ? 'synced' : 'pending',
      description: description || undefined,
      comfyUIPath: uploadedToComfyUI ? `models/loras/${uniqueFileName}` : undefined
    };
    
    // Save to database
    console.log('💾 Saving influencer to database...');
    try {
      await addUserInfluencer(userId, influencer);
      console.log('✅ Influencer saved to database successfully');
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save to database',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        },
        { status: 500 }
      );
    }
    
    // Return success response
    const response = {
      success: true,
      message: 'LoRA uploaded and processed successfully',
      influencer: {
        id: influencer.id,
        name: influencer.name,
        displayName: influencer.displayName,
        fileName: influencer.fileName,
        originalFileName: influencer.originalFileName,
        fileSize: influencer.fileSize,
        uploadedAt: influencer.uploadedAt,
        isActive: influencer.isActive,
        syncStatus: influencer.syncStatus,
        description: influencer.description
      },
      uploadedToComfyUI,
      comfyUIError: comfyUIError || undefined,
      instructions: uploadedToComfyUI ? undefined : {
        title: "LoRA Upload Complete!",
        note: "Your LoRA has been uploaded to blob storage and will be automatically synced to ComfyUI in the background."
      }
    };
    
    console.log('✅ === UPLOAD COMPLETION SUCCESSFUL ===');
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('💥 Fatal error in blob-complete endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Upload completion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to upload LoRA to ComfyUI
async function uploadLoRAToComfyUI(blobUrl: string, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`📡 Downloading file from blob: ${blobUrl}`);
    
    // Download the file from Vercel Blob with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const blobResponse = await fetch(blobUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!blobResponse.ok) {
      console.error('❌ Failed to download from blob:', blobResponse.status, blobResponse.statusText);
      return false;
    }
    
    const fileBuffer = await blobResponse.arrayBuffer();
    console.log(`✅ Downloaded file from blob (${fileBuffer.byteLength} bytes)`);
    
    // Prepare form data for ComfyUI
    const formData = new FormData();
    formData.append('image', new Blob([fileBuffer]), fileName);
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    console.log(`📤 Uploading to ComfyUI: ${COMFYUI_URL}/upload/image`);
    
    // Upload to ComfyUI with timeout
    const uploadController = new AbortController();
    const uploadTimeoutId = setTimeout(() => uploadController.abort(), 60000); // 60 second timeout
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
      signal: uploadController.signal
    });
    
    clearTimeout(uploadTimeoutId);
    
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
      console.error('❌ Error in uploadLoRAToComfyUI:', error);
    }
    return false;
  }
}