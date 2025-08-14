// app/api/user/influencers/upload-token/route.ts - Handle blob uploads properly
import { NextRequest } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Upload token request received');
    console.log('🔧 BLOB_READ_WRITE_TOKEN available:', !!process.env.BLOB_READ_WRITE_TOKEN);
    
    // Return handleUpload directly - it already returns the proper Response
    return await handleUpload({
      body: request.body as unknown as HandleUploadBody,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate the user  
        console.log('🔧 onBeforeGenerateToken called for path:', pathname);
        
        const userId = await getUserId(request);
        if (!userId) {
          console.error('❌ No user ID found during authentication');
          throw new Error('Unauthorized: No user ID found');
        }
        
        console.log('🎫 Generating upload token for user:', userId, 'path:', pathname);
        
        return {
          allowedContentTypes: [
            'application/octet-stream',
            'application/x-binary', 
            'model/safetensors'
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('✅ Client-side blob upload completed:', blob.url);
        // The completion will be handled by a separate API call from the frontend
      },
    });

  } catch (error) {
    console.error('❌ Error in blob upload handler:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Upload token generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
