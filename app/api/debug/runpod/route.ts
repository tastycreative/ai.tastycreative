// Test RunPod connection endpoint
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const RUNPOD_API_URL = process.env.RUNPOD_API_URL;
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

    if (!RUNPOD_API_URL || !RUNPOD_API_KEY) {
      return NextResponse.json({ 
        error: 'RunPod configuration missing',
        config: {
          hasUrl: !!RUNPOD_API_URL,
          hasKey: !!RUNPOD_API_KEY,
          urlPreview: RUNPOD_API_URL?.substring(0, 50) + '...'
        }
      }, { status: 500 });
    }

    // Test multiple URL formats to see which one works
    const testUrls = [
      `${RUNPOD_API_URL}/run`,
      `${RUNPOD_API_URL}/runsync`, 
      RUNPOD_API_URL // Direct URL
    ];

    const testPayload = {
      input: {
        test: true,
        message: 'Connection test',
        timestamp: new Date().toISOString()
      }
    };

    const results = [];

    for (const testUrl of testUrls) {
      try {
        console.log(`🧪 Testing URL: ${testUrl}`);
        
        const response = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
          },
          body: JSON.stringify(testPayload),
        });

        const responseText = await response.text();
        
        results.push({
          url: testUrl,
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 200)
        });

      } catch (error) {
        results.push({
          url: testUrl,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: 'RunPod connection test results',
      originalUrl: RUNPOD_API_URL,
      results,
      recommendation: results.find(r => r.success) ? 
        `Use: ${results.find(r => r.success)?.url}` : 
        'No working endpoint found. Check RunPod dashboard.'
    });

  } catch (error) {
    console.error('RunPod test error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test RunPod connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
