// app/api/debug/test-blob-complete/route.ts - Test blob-complete endpoint
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing blob-complete endpoint...');
    
    const testBlobUrl = 'https://kwjks4nt08wcoqbn.public.blob.vercel-storage.com/test-file.txt';
    
    const response = await fetch(`${request.nextUrl.origin}/api/user/influencers/blob-complete`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blobUrl: testBlobUrl,
        fileName: 'test.safetensors',
        displayName: 'Test LoRA',
        description: 'Test description',
        fileSize: 1000,
      }),
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
      endpoint: '/api/user/influencers/blob-complete'
    });
    
  } catch (error) {
    console.error('🐛 Test blob-complete error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: '/api/user/influencers/blob-complete'
    }, { status: 500 });
  }
}
