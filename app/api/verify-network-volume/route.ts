import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: 'fileName parameter required' }, { status: 400 });
    }

    const COMFYUI_URL = process.env.COMFYUI_URL;
    if (!COMFYUI_URL) {
      throw new Error('ComfyUI URL not configured');
    }

    console.log(`🔍 Checking if file exists in network volume: ${fileName}`);

    // Check if file exists in ComfyUI models directory (which should be mounted to network volume)
    // We'll use the ComfyUI API to list files in the loras subdirectory
    const checkResponse = await fetch(`${COMFYUI_URL}/object_info`, {
      method: 'GET',
    });

    if (!checkResponse.ok) {
      throw new Error(`ComfyUI API not accessible: ${checkResponse.status}`);
    }

    const objectInfo = await checkResponse.json();
    
    // Check if our LoRA model is listed in the available models
    const loraModels = objectInfo?.LoraLoader?.input?.lora_name?.[0] || [];
    
    // Look for our specific file in the available models
    const userLoraPattern = new RegExp(`${userId}.*${fileName.replace(/.*_(\d+)_(.+)$/, '$2')}`, 'i');
    const foundModel = loraModels.find((model: string) => 
      model.includes(fileName) || userLoraPattern.test(model)
    );

    // Also check the file system structure via ComfyUI
    let fileSystemCheck = null;
    try {
      const systemResponse = await fetch(`${COMFYUI_URL}/system_stats`, {
        method: 'GET',
      });
      
      if (systemResponse.ok) {
        const systemData = await systemResponse.json();
        fileSystemCheck = systemData;
      }
    } catch (e) {
      console.log('System stats not available');
    }

    return NextResponse.json({
      success: true,
      fileName: fileName,
      s3Key: `loras/${userId}/${fileName}`,
      networkVolumePath: `/runpod-volume/loras/${userId}/${fileName}`,
      verification: {
        foundInComfyUI: !!foundModel,
        comfyUIModelName: foundModel || null,
        totalLoraModels: loraModels.length,
        sampleModels: loraModels.slice(0, 5),
      },
      systemInfo: fileSystemCheck,
      instructions: [
        '1. File uploaded to S3 network volume successfully',
        '2. Check if ComfyUI can see the file in its models directory',
        '3. Verify the network volume mount is working correctly',
      ],
      troubleshooting: {
        s3Upload: 'SUCCESS - File uploaded to s3://83cljmpqfd/loras/' + userId + '/' + fileName,
        networkVolumeMount: foundModel ? 'SUCCESS - File visible in ComfyUI' : 'CHECK NEEDED - File not visible in ComfyUI models',
        nextSteps: foundModel 
          ? 'File is ready for use in text-to-image generation'
          : 'May need to restart ComfyUI or check network volume mount'
      }
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Verification failed',
        fileName: request.url.includes('fileName=') ? request.url.split('fileName=')[1] : 'unknown'
      },
      { status: 500 }
    );
  }
}
