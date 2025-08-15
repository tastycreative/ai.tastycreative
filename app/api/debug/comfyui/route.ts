// app/api/debug/comfyui/route.ts - Debug ComfyUI connection
// ===========================================
import { NextRequest, NextResponse } from 'next/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15279';

export async function GET(request: NextRequest) {
  try {
    console.log('🖥️ === COMFYUI DEBUG CHECK ===');
    console.log('🔗 ComfyUI URL:', COMFYUI_URL);
    
    const debug: any = {
      comfyUIUrl: COMFYUI_URL,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Test 1: Basic connectivity
    try {
      console.log('🔌 Testing basic connectivity...');
      const response = await fetch(`${COMFYUI_URL}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      debug.checks.connectivity = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      };
      
      if (response.ok) {
        const stats = await response.json();
        debug.checks.connectivity.systemStats = stats;
        console.log('✅ Basic connectivity: OK');
      } else {
        console.log('❌ Basic connectivity failed:', response.status);
      }
    } catch (error) {
      debug.checks.connectivity = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('💥 Basic connectivity error:', error);
    }

    // Test 2: Queue status
    try {
      console.log('📋 Testing queue endpoint...');
      const response = await fetch(`${COMFYUI_URL}/queue`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      debug.checks.queue = {
        success: response.ok,
        status: response.status
      };
      
      if (response.ok) {
        const queue = await response.json();
        debug.checks.queue.data = {
          running: queue.queue_running?.length || 0,
          pending: queue.queue_pending?.length || 0
        };
        console.log('✅ Queue check: OK', debug.checks.queue.data);
      }
    } catch (error) {
      debug.checks.queue = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('💥 Queue check error:', error);
    }

    // Test 3: Object info (for LoRA models)
    try {
      console.log('🎯 Testing object_info endpoint...');
      const response = await fetch(`${COMFYUI_URL}/object_info`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      
      debug.checks.objectInfo = {
        success: response.ok,
        status: response.status
      };
      
      if (response.ok) {
        const objectInfo = await response.json();
        const loraLoader = objectInfo.LoraLoaderModelOnly;
        
        debug.checks.objectInfo.data = {
          hasLoraLoader: !!loraLoader,
          availableLoRAs: loraLoader?.input?.required?.lora_name?.[0]?.length || 0,
          sampleLoRAs: loraLoader?.input?.required?.lora_name?.[0]?.slice(0, 5) || [],
          totalNodes: Object.keys(objectInfo).length
        };
        console.log('✅ Object info check: OK', debug.checks.objectInfo.data);
      }
    } catch (error) {
      debug.checks.objectInfo = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log('💥 Object info check error:', error);
    }

    // Summary
    const allChecks = Object.values(debug.checks);
    const successfulChecks = allChecks.filter((check: any) => check.success).length;
    const totalChecks = allChecks.length;
    
    debug.summary = {
      overallHealth: successfulChecks === totalChecks ? 'healthy' : 
                    successfulChecks > totalChecks / 2 ? 'partial' : 'unhealthy',
      successfulChecks,
      totalChecks,
      recommendations: []
    };

    // Add recommendations
    if (!debug.checks.connectivity?.success) {
      debug.summary.recommendations.push('ComfyUI server is not accessible. Check if it\'s running and the URL is correct.');
    }
    if (!debug.checks.queue?.success) {
      debug.summary.recommendations.push('Queue endpoint is not working. This may affect job submission.');
    }
    if (!debug.checks.objectInfo?.success) {
      debug.summary.recommendations.push('Object info endpoint is not working. This may affect LoRA model detection.');
    }

    console.log('📊 === DEBUG SUMMARY ===');
    console.log('🏥 Overall health:', debug.summary.overallHealth);
    console.log('✅ Successful checks:', `${successfulChecks}/${totalChecks}`);

    return NextResponse.json({
      success: true,
      debug
    });

  } catch (error) {
    console.error('💥 ComfyUI debug error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          comfyUIUrl: COMFYUI_URL,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}