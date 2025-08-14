import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';
    
    console.log(`🔍 Testing ComfyUI connection to: ${COMFYUI_URL}`);
    
    // Test basic connectivity
    const response = await fetch(`${COMFYUI_URL}/system_stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    console.log(`📡 ComfyUI response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.text();
      console.log(`✅ ComfyUI is reachable. Response:`, data.substring(0, 200));
      
      return NextResponse.json({
        success: true,
        message: "ComfyUI is reachable",
        url: COMFYUI_URL,
        status: response.status,
        response: data.substring(0, 500)
      });
    } else {
      console.log(`❌ ComfyUI returned error status: ${response.status}`);
      
      return NextResponse.json({
        success: false,
        message: "ComfyUI returned error status",
        url: COMFYUI_URL,
        status: response.status
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ ComfyUI connection test failed:', error);
    
    return NextResponse.json({
      success: false,
      message: "Failed to connect to ComfyUI",
      url: process.env.COMFYUI_URL || 'http://209.53.88.242:14753',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
