// app/api/user/influencers/upload-token/route.ts - Handle blob uploads properly
import { NextRequest } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  return handleUpload({
    body: request.body as unknown as HandleUploadBody,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      // Authenticate the user  
      const userId = await getUserId(request);
      if (!userId) {
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
}
