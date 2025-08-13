import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Test webhook GET works',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Test webhook POST received:', body);
    
    return NextResponse.json({
      message: 'Test webhook POST works',
      received: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to parse JSON',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}
