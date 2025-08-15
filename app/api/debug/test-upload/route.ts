// app/api/debug/test-upload/route.ts - Test simplified blob upload
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing server-side blob upload...');
    
    // Check user auth
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create a simple test file
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testFileName = `test-${userId}-${Date.now()}.txt`;
    
    console.log('📤 Uploading test file:', testFileName);
    
    // Use server-side upload
    const blob = await put(testFileName, testContent, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    console.log('✅ Server-side upload successful:', blob.url);
    
    return NextResponse.json({
      success: true,
      url: blob.url,
      fileName: testFileName,
      method: 'server-side'
    });
    
  } catch (error) {
    console.error('❌ Server-side upload error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      method: 'server-side'
    }, { status: 500 });
  }
}
