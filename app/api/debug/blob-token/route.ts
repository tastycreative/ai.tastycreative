// app/api/debug/blob-token/route.ts - Debug blob token generation
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Debug: Testing blob token generation...');
    
    // Check environment variable
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    console.log('🔑 BLOB_READ_WRITE_TOKEN exists:', !!blobToken);
    console.log('🔑 Token length:', blobToken?.length || 0);
    
    // Check user authentication
    const userId = await getUserId(request);
    console.log('👤 User ID:', userId);
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'No user ID found',
        hasToken: !!blobToken,
        tokenLength: blobToken?.length || 0
      }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      userId,
      hasToken: !!blobToken,
      tokenLength: blobToken?.length || 0,
      tokenPrefix: blobToken ? blobToken.substring(0, 20) + '...' : 'none'
    });
    
  } catch (error) {
    console.error('🐛 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN
    }, { status: 500 });
  }
}
