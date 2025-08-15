// app/api/user/influencers/blob-complete/route.ts - Complete LoRA upload after blob storage
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🚀 Blob complete endpoint called!');
  
  try {
    const data = await request.json();
    console.log('📥 Received data:', data);
    
    return NextResponse.json({
      success: true,
      message: 'Blob complete endpoint is working!',
      received: data
    });
    
  } catch (error) {
    console.error('❌ Error in blob-complete:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Request processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}