// app/api/models/loras/route.ts (Updated)
import { NextRequest, NextResponse } from 'next/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

// Helper to get user ID (implement your auth logic here)
function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'default-user';
}

// Import the influencers database (in production, use shared database)
const influencersDb: Map<string, any[]> = new Map();

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    console.log('Fetching LoRAs for user:', userId);
    
    // Get user's influencers from our database
    const userInfluencers = influencersDb.get(userId) || [];
    const activeInfluencers = userInfluencers.filter(inf => inf.isActive);
    
    console.log('Found active influencers:', activeInfluencers.length);
    
    // Convert to the format expected by the text-to-image component
    const userLoRAModels = activeInfluencers.map(inf => inf.fileName);
    
    // Always include "None" option for base model
    const availableLoRAs = ['None', ...userLoRAModels];
    
    // Optional: Verify that the LoRAs exist in ComfyUI
    // This step ensures the files are actually available in ComfyUI
    let verifiedLoRAs = availableLoRAs;
    
    try {
      console.log('Verifying LoRAs with ComfyUI...');
      const response = await fetch(`${COMFYUI_URL}/object_info`);
      
      if (response.ok) {
        const objectInfo = await response.json();
        const loraLoader = objectInfo.LoraLoaderModelOnly;
        
        if (loraLoader && loraLoader.input && loraLoader.input.required && loraLoader.input.required.lora_name) {
          const comfyUILoRAs = loraLoader.input.required.lora_name[0] || [];
          
          // Filter user LoRAs to only include those actually available in ComfyUI
          const verifiedUserLoRAs = userLoRAModels.filter(loraName => 
            comfyUILoRAs.includes(loraName)
          );
          
          verifiedLoRAs = ['None', ...verifiedUserLoRAs];
          
          console.log('Verified LoRAs:', verifiedLoRAs.length - 1); // -1 for "None"
          
          // Mark unavailable LoRAs in our database (optional)
          const unavailableLoRAs = userLoRAModels.filter(loraName => 
            !comfyUILoRAs.includes(loraName)
          );
          
          if (unavailableLoRAs.length > 0) {
            console.warn('Some user LoRAs not found in ComfyUI:', unavailableLoRAs);
            
            // Optionally update the database to mark these as inactive
            const updatedInfluencers = userInfluencers.map(inf => {
              if (unavailableLoRAs.includes(inf.fileName)) {
                return { ...inf, isActive: false, syncStatus: 'missing' };
              }
              return inf;
            });
            
            influencersDb.set(userId, updatedInfluencers);
          }
        }
      }
    } catch (verificationError) {
      console.error('Error verifying LoRAs with ComfyUI:', verificationError);
      // Continue with unverified list if verification fails
    }
    
    return NextResponse.json({
      success: true,
      models: verifiedLoRAs,
      userModelsCount: verifiedLoRAs.length - 1, // Exclude "None"
      totalInfluencers: userInfluencers.length,
      activeInfluencers: activeInfluencers.length
    });

  } catch (error) {
    console.error('Error fetching user LoRA models:', error);
    
    // Fallback to basic response
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch LoRA models',
        models: ['None'], // Always provide at least the base model option
        userModelsCount: 0
      },
      { status: 500 }
    );
  }
}

// GET with query parameter for admin/debug purposes
export async function POST(request: NextRequest) {
  try {
    const { action, userId: targetUserId } = await request.json();
    const requestingUserId = getUserId(request);
    
    if (action === 'sync_user_loras') {
      // Sync a specific user's LoRAs with ComfyUI
      const userId = targetUserId || requestingUserId;
      const userInfluencers = influencersDb.get(userId) || [];
      
      console.log(`Syncing LoRAs for user ${userId}...`);
      
      // Check which user LoRAs are actually available in ComfyUI
      const response = await fetch(`${COMFYUI_URL}/object_info`);
      if (!response.ok) {
        throw new Error('Failed to fetch ComfyUI info');
      }
      
      const objectInfo = await response.json();
      const loraLoader = objectInfo.LoraLoaderModelOnly;
      const comfyUILoRAs = loraLoader?.input?.required?.lora_name?.[0] || [];
      
      const syncResults = userInfluencers.map(inf => {
        const isAvailable = comfyUILoRAs.includes(inf.fileName);
        return {
          id: inf.id,
          fileName: inf.fileName,
          displayName: inf.displayName,
          isAvailable,
          syncStatus: isAvailable ? 'synced' : 'missing'
        };
      });
      
      return NextResponse.json({
        success: true,
        syncResults,
        message: `Sync completed for user ${userId}`
      });
    }
    
    if (action === 'refresh_comfyui_cache') {
      // Force ComfyUI to refresh its model cache
      try {
        const response = await fetch(`${COMFYUI_URL}/models/refresh`, {
          method: 'POST'
        });
        
        return NextResponse.json({
          success: response.ok,
          message: response.ok ? 'ComfyUI cache refreshed' : 'Failed to refresh cache'
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: 'ComfyUI refresh endpoint not available'
        });
      }
    }
    
    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error in LoRA management action:', error);
    return NextResponse.json(
      { success: false, error: 'Action failed' },
      { status: 500 }
    );
  }
}

// Cache the results for better performance
export const revalidate = 60; // Cache for 1 minute