// app/api/user/influencers/upload-url/route.ts - Generate upload URL for client-side blob upload
import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  return handleUpload({
    body: await request.json() as HandleUploadBody,
    request,
    onBeforeGenerateToken: async (pathname) => {
      console.log('🎫 Generating upload token for path:', pathname);
      
      // Authenticate the user
      const userId = await getUserId(request);
      if (!userId) {
        throw new Error('Unauthorized: No user ID found');
      }
      
      console.log('👤 Upload authorized for user:', userId);
      
      return {
        allowedContentTypes: ['application/octet-stream'],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500MB limit
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      console.log('✅ Client-side blob upload completed:', blob.url);
    },
  });
}