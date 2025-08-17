// app/api/training/download-model/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT = '619nf3200u97xi';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runpodJobId } = await request.json();

    if (!runpodJobId) {
      return NextResponse.json({ 
        error: 'Missing runpodJobId' 
      }, { status: 400 });
    }

    console.log(`🔍 Attempting to download model from RunPod job: ${runpodJobId}`);

    // First, check if the job still exists and get its status
    const statusResponse = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT}/status/${runpodJobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to get job status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log('📋 Job status:', statusData);

    if (statusData.status !== 'COMPLETED') {
      return NextResponse.json({
        error: 'Job not completed',
        status: statusData.status,
        details: statusData
      }, { status: 400 });
    }

    // For serverless RunPod, the outputs are typically in the response
    // The model files should be accessible through the output URLs
    if (statusData.output && statusData.output.model_files) {
      return NextResponse.json({
        success: true,
        message: 'Model files found in job output',
        modelFiles: statusData.output.model_files,
        downloadInstructions: [
          '1. The model files are available in the job output',
          '2. Download the .safetensors file to your local system',
          '3. Upload it to your LoRA models directory',
          '4. Update the LoRA status to active'
        ]
      });
    }

    // If no direct download URLs, provide manual instructions
    return NextResponse.json({
      success: true,
      message: 'Job completed - manual download required',
      instructions: [
        'Since this was a serverless job, the model files are ephemeral.',
        'The trained model aiai.safetensors was created but may no longer be accessible.',
        'For future training jobs, consider:',
        '1. Using persistent storage',
        '2. Implementing automatic upload to your storage system',
        '3. Using the webhook system to process results immediately'
      ],
      jobDetails: statusData
    });

  } catch (error) {
    console.error('❌ Error downloading model:', error);
    return NextResponse.json({
      error: 'Failed to download model',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
