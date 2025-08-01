// app/api/models/loras/route.ts
import { NextRequest, NextResponse } from 'next/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

export async function GET(request: NextRequest) {
  try {
    // Fetch object info from ComfyUI which contains available models
    const response = await fetch(`${COMFYUI_URL}/object_info`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from ComfyUI');
    }

    const objectInfo = await response.json();
    
    // Extract LoRA models from LoraLoaderModelOnly node info
    const loraLoader = objectInfo.LoraLoaderModelOnly;
    let loraModels: string[] = [];

    if (loraLoader && loraLoader.input && loraLoader.input.required && loraLoader.input.required.lora_name) {
      loraModels = loraLoader.input.required.lora_name[0] || [];
    }

    // Filter out empty strings and add "None" option
    const availableLoRAs = ['None', ...loraModels.filter((model: string) => model && model.trim())];

    return NextResponse.json({
      success: true,
      models: availableLoRAs
    });

  } catch (error) {
    console.error('Error fetching LoRA models:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch LoRA models',
        models: ['None', 'AI MODEL 2.safetensors'] // Fallback
      },
      { status: 500 }
    );
  }
}

// Optional: Cache the results for better performance
export const revalidate = 300; // Cache for 5 minutes