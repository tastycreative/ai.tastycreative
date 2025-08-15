// app/api/test-chunked/route.ts - Test endpoint for chunked upload
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Chunked upload endpoints are ready",
    endpoints: {
      uploadChunked: "/api/user/influencers/upload-chunked",
      completeUpload: "/api/user/influencers/complete-upload",
      testChunked: "/api/test-chunked"
    },
    info: {
      maxChunkSize: "4MB recommended",
      largeFileThreshold: "50MB",
      supportedFormats: [".safetensors", ".pt", ".ckpt"]
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      success: true,
      message: "Test chunked upload endpoint working",
      receivedData: body,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to parse request",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}
