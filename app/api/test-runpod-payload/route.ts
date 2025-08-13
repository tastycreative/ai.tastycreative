// Test RunPod with the corrected payload structure
import { NextRequest, NextResponse } from 'next/server';

export async function POST() {
  const RUNPOD_API_URL = process.env.RUNPOD_API_URL;
  const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

  // Match the expected structure based on handler analysis
  const payload = {
    input: {
      job_id: "test_job_" + Date.now(),
      name: "test_training_model",
      config: {
        model: { 
          name_or_path: "black-forest-labs/FLUX.1-dev",
          arch: "flux"
        },
        train: { 
          steps: 500,
          batch_size: 1,
          gradient_accumulation: 1, // Fixed to match ai-toolkit exactly
          lr: 0.0001
        },
        network: { 
          type: "lora",
          linear: 16,
          linear_alpha: 16
        },
        save: { 
          dtype: "float16",
          save_every: 250
        },
        sample: { 
          samples: [{ prompt: "a beautiful landscape" }],
          sampler: "flowmatch"
        }
      },
      imageFiles: [{
        filename: "test_image_001.jpg",
        caption: "test training image",
        data: "base64_placeholder_data",
        storageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/test/image.jpg`
      }],
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/training/test_job_${Date.now()}`
    }
  };

  try {
    console.log('🧪 Testing RunPod with corrected structure');
    console.log('📤 Job ID:', payload.input.job_id);
    console.log('📤 Image count:', payload.input.imageFiles.length);

    const response = await fetch(RUNPOD_API_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    
    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Body:', responseText);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response: responseText,
      sentPayload: {
        job_id: payload.input.job_id,
        imageCount: payload.input.imageFiles.length,
        configKeys: Object.keys(payload.input.config)
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: payload.input.job_id
    }, { status: 500 });
  }
}
