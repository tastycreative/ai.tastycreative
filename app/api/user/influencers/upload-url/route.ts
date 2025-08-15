// app/api/user/influencers/upload-url/route.ts - Generate upload URL for client-side blob upload
import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🎫 === UPLOAD URL REQUEST ===');
    
    // Check if we have the blob token
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    console.log('🔑 BLOB_READ_WRITE_TOKEN available:', !!blobToken);
    
    if (!blobToken) {
      console.error('❌ Missing BLOB_READ_WRITE_TOKEN environment variable');
      return NextResponse.json({
        error: 'Server configuration error: Missing blob token'
      }, { status: 500 });
    }
    
    const response = await handleUpload({
      body: await request.json() as HandleUploadBody,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('🎫 Generating upload token for path:', pathname);
        
        // Authenticate the user
        const userId = await getUserId(request);
        if (!userId) {
          console.error('❌ No user ID found during token generation');
          throw new Error('Unauthorized: No user ID found');
        }
        
        console.log('👤 Upload authorized for user:', userId);
        
        return {
          allowedContentTypes: ['application/octet-stream', 'application/x-safetensors'],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB limit
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('✅ Client-side blob upload completed:', blob.url);
      },
    });
    
    // Convert the handleUpload response to a proper NextResponse
    return NextResponse.json(response);
  } catch (error) {
    console.error('💥 Error in upload-url handler:', error);
    return NextResponse.json({
      error: 'Failed to generate upload URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}