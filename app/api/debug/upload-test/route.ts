// app/api/debug/upload-test/route.ts - Diagnostic endpoint for upload issues
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14967';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    // Test ComfyUI connectivity
    let comfyuiStatus = 'unknown';
    let comfyuiError: string | null = null;
    
    try {
      const testResponse = await fetch(`${COMFYUI_URL}/api/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (testResponse.ok) {
        comfyuiStatus = 'connected';
      } else {
        comfyuiStatus = 'error';
        comfyuiError = `HTTP ${testResponse.status}`;
      }
    } catch (error) {
      comfyuiStatus = 'connection_failed';
      comfyuiError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    return NextResponse.json({
      success: true,
      diagnostics: {
        timestamp: new Date().toISOString(),
        authentication: {
          userId: userId ? 'authenticated' : 'not_authenticated',
          hasUserId: !!userId
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          comfyuiUrl: COMFYUI_URL,
          isProduction: process.env.NODE_ENV === 'production',
          hasComfyuiUrl: !!process.env.COMFYUI_URL
        },
        comfyui: {
          status: comfyuiStatus,
          error: comfyuiError,
          url: COMFYUI_URL
        },
        vercel: {
          region: process.env.VERCEL_REGION || 'unknown',
          memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || 'unknown',
          timeout: process.env.AWS_LAMBDA_FUNCTION_TIMEOUT || 'unknown'
        }
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics: {
        timestamp: new Date().toISOString(),
        error: 'Failed to run diagnostics'
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        diagnostics: { userId: null }
      }, { status: 401 });
    }
    
    // Test form data parsing
    let formDataTest = 'unknown';
    let fileTest = 'no_file';
    let fileSize = 0;
    
    try {
      const formData = await request.formData();
      formDataTest = 'parsed_successfully';
      
      const file = formData.get('file') as File;
      if (file) {
        fileTest = 'file_received';
        fileSize = file.size;
      } else {
        fileTest = 'no_file_in_formdata';
      }
      
    } catch (error) {
      formDataTest = `parse_error: ${error instanceof Error ? error.message : 'Unknown'}`;
    }
    
    return NextResponse.json({
      success: true,
      diagnostics: {
        timestamp: new Date().toISOString(),
        authentication: {
          userId: 'authenticated',
          userIdValue: userId
        },
        upload: {
          formDataTest,
          fileTest,
          fileSize: fileSize > 0 ? `${fileSize} bytes` : 'no_file',
          maxPayloadInfo: 'Vercel limit is typically 4.5MB for hobby plan'
        }
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics: {
        timestamp: new Date().toISOString(),
        error: 'POST test failed'
      }
    }, { status: 500 });
  }
}
