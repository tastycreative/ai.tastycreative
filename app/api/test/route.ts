// app/api/test/route.ts - FIXED test endpoint to verify routing
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    console.log('🧪 === API TEST ENDPOINT ===');
    console.log('📍 Request URL:', request.url);
    console.log('🔧 Request method:', request.method);
    console.log('👤 User ID:', userId);
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    const headers = Object.fromEntries(request.headers.entries());
    console.log('📋 Request headers:', headers);
    
    return NextResponse.json({
      success: true,
      message: 'API routing is working correctly! ✅',
      endpoint: '/api/test',
      method: 'GET',
      timestamp: new Date().toISOString(),
      userId: userId,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        comfyUIUrl: process.env.COMFYUI_URL || 'http://209.53.88.242:14753'
      },
      headers: {
        'user-agent': request.headers.get('user-agent'),
        'x-user-id': request.headers.get('x-user-id'),
        'content-type': request.headers.get('content-type')
      },
      debug: {
        hasUserId: !!userId,
        userIdLength: userId ? userId.length: 0,
        requestUrlPath: new URL(request.url).pathname,
        serverTime: new Date().toLocaleString()
      }
    });
  } catch (error) {
    console.error('💥 API test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: '/api/test',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    console.log('🧪 === API TEST POST ENDPOINT ===');
    console.log('📍 Request URL:', request.url);
    console.log('👤 User ID:', userId);
    
    let body = null;
    try {
      body = await request.json();
      console.log('📦 Request body:', body);
    } catch (parseError) {
      console.log('⚠️ No JSON body or parse error:', parseError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'POST request received correctly! ✅',
      endpoint: '/api/test',
      method: 'POST',
      timestamp: new Date().toISOString(),
      userId: userId,
      receivedData: body,
      debug: {
        hasBody: !!body,
        bodyType: typeof body,
        contentType: request.headers.get('content-type')
      }
    });
  } catch (error) {
    console.error('💥 API test POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: '/api/test',
        method: 'POST',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}