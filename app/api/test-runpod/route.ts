// Simple RunPod test - matches your Python example exactly
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
  };

  const data = {
    'input': {
      "test": true,
      "prompt": "Test connection from Next.js app",
      "timestamp": new Date().toISOString()
    }
  };

  try {
    console.log('🧪 Testing RunPod endpoint:', process.env.RUNPOD_API_URL);
    
    const response = await fetch(process.env.RUNPOD_API_URL!, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    const responseText = await response.text();
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: process.env.RUNPOD_API_URL,
      response: responseText,
      sentData: data
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      url: process.env.RUNPOD_API_URL
    }, { status: 500 });
  }
}
