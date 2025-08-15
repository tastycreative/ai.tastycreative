// app/api/user/influencers/upload-chunked/route.ts - Chunked Upload for Large Files
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

// Configure for Vercel deployment
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute per chunk
export const dynamic = 'force-dynamic';

// In-memory storage for chunks (for development - in production use Redis or similar)
const chunkStorage = new Map<string, { chunks: Buffer[], metadata: any }>();

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileName = formData.get('fileName') as string;
    const displayName = formData.get('displayName') as string;
    const uploadId = formData.get('uploadId') as string;

    console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`);

    if (!chunk || !fileName || !uploadId) {
      return NextResponse.json(
        { success: false, error: 'Missing required chunk data' },
        { status: 400 }
      );
    }

    // Convert chunk to buffer
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

    // Store chunk
    if (!chunkStorage.has(uploadId)) {
      chunkStorage.set(uploadId, { 
        chunks: new Array(totalChunks).fill(null),
        metadata: { fileName, displayName, userId, totalChunks }
      });
    }

    const storage = chunkStorage.get(uploadId)!;
    storage.chunks[chunkIndex] = chunkBuffer;

    // Check if all chunks are received
    const allChunksReceived = storage.chunks.every(chunk => chunk !== null);

    if (allChunksReceived) {
      console.log(`✅ All chunks received for ${fileName}, assembling file...`);
      
      // Combine all chunks
      const completeFile = Buffer.concat(storage.chunks);
      
      // Clean up chunk storage
      chunkStorage.delete(uploadId);

      console.log(`📁 File assembled: ${fileName} (${completeFile.length} bytes)`);

      // Now upload the complete file to ComfyUI
      const uploadSuccess = await uploadBufferToComfyUI(completeFile, fileName);

      if (uploadSuccess) {
        // Trigger the completion handler
        const completionResponse = await fetch(`${request.nextUrl.origin}/api/user/influencers/complete-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || '',
          },
          body: JSON.stringify({
            fileName,
            displayName,
            fileSize: completeFile.length,
            uploadMethod: 'chunked'
          })
        });

        if (completionResponse.ok) {
          const completionData = await completionResponse.json();
          return NextResponse.json({
            success: true,
            isComplete: true,
            message: 'File uploaded successfully',
            influencer: completionData.influencer
          });
        } else {
          throw new Error('Failed to complete upload process');
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to upload to ComfyUI' },
          { status: 500 }
        );
      }
    } else {
      // Return progress
      const receivedChunks = storage.chunks.filter(chunk => chunk !== null).length;
      return NextResponse.json({
        success: true,
        isComplete: false,
        progress: (receivedChunks / totalChunks) * 100,
        receivedChunks,
        totalChunks
      });
    }

  } catch (error) {
    console.error('💥 Chunked upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chunked upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function uploadBufferToComfyUI(fileBuffer: Buffer, fileName: string): Promise<boolean> {
  const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
  
  try {
    console.log(`📡 Uploading complete file to ComfyUI: ${fileName} (${fileBuffer.length} bytes)`);
    
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    formData.append('image', blob, fileName);
    formData.append('type', 'input');
    formData.append('subfolder', 'loras');
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(180000) // 3 minute timeout
    });
    
    if (uploadResponse.ok) {
      console.log('✅ Successfully uploaded to ComfyUI');
      return true;
    } else {
      console.error('❌ ComfyUI upload failed:', uploadResponse.status);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error uploading to ComfyUI:', error);
    return false;
  }
}
