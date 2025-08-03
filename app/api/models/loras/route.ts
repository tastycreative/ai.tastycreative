// app/api/models/loras/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserId, getUserInfluencers, updateUserInfluencer } from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    console.log('Fetching LoRAs for user:', userId);
    
    // Get user's influencers from shared database
    const userInfluencers = getUserInfluencers(userId);
    const activeInfluencers = userInfluencers.filter(inf => inf.isActive && inf.syncStatus === 'synced');
    
    console.log('Found active influencers:', activeInfluencers.length);
    
    // Convert to the format expected by the text-to-image component
    const userLoRAModels = activeInfluencers.map(inf => inf.fileName);
    
    // Always include "None" option for base model
    let availableLoRAs = ['None', ...userLoRAModels];
    
    // Verify that the LoRAs actually exist in ComfyUI
    try {
      console.log('Verifying LoRAs with ComfyUI...');
      const response = await fetch(`${COMFYUI_URL}/object_info`);
      
      if (response.ok) {
        const objectInfo = await response.json();
        const loraLoader = objectInfo.LoraLoaderModelOnly;
        
        if (loraLoader?.input?.required?.lora_name?.[0]) {
          const comfyUILoRAs = loraLoader.input.required.lora_name[0];
          console.log('ComfyUI available LoRAs:', comfyUILoRAs.length);
          
          // Filter user LoRAs to only include those actually available in ComfyUI
          const verifiedUserLoRAs = [];
          const syncUpdates = [];
          
          for (const influencer of activeInfluencers) {
            const isAvailableInComfyUI = comfyUILoRAs.includes(influencer.fileName);
            
            if (isAvailableInComfyUI) {
              verifiedUserLoRAs.push(influencer.fileName);
              
              // Update sync status if needed
              if (influencer.syncStatus !== 'synced') {
                syncUpdates.push({
                  id: influencer.id,
                  updates: { syncStatus: 'synced' as const }
                });
              }
            } else {
              // Mark as missing
              syncUpdates.push({
                id: influencer.id,
                updates: { 
                  syncStatus: 'missing' as const,
                  isActive: false 
                }
              });
            }
          }
          
          // Apply sync updates
          for (const update of syncUpdates) {
            updateUserInfluencer(userId, update.id, update.updates);
          }
          
          availableLoRAs = ['None', ...verifiedUserLoRAs];
          
          console.log('Verified LoRAs count:', verifiedUserLoRAs.length);
          
          if (syncUpdates.length > 0) {
            console.log('Updated sync status for', syncUpdates.length, 'LoRAs');
          }
        }
      } else {
        console.warn('Could not verify LoRAs with ComfyUI, using cached list');
      }
    } catch (verificationError) {
      console.error('Error verifying LoRAs with ComfyUI:', verificationError);
      // Continue with unverified list if verification fails
    }
    
    return NextResponse.json({
      success: true,
      models: availableLoRAs,
      userModelsCount: availableLoRAs.length - 1, // Exclude "None"
      totalInfluencers: userInfluencers.length,
      activeInfluencers: userInfluencers.filter(inf => inf.isActive).length,
      syncedInfluencers: userInfluencers.filter(inf => inf.syncStatus === 'synced').length
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

// POST endpoint for LoRA management actions
export async function POST(request: NextRequest) {
  try {
    const { action, userId: targetUserId } = await request.json();
    const requestingUserId = getUserId(request);
    
    if (action === 'sync_user_loras') {
      // Sync a specific user's LoRAs with ComfyUI
      const userId = targetUserId || requestingUserId;
      const userInfluencers = getUserInfluencers(userId);
      
      console.log(`Syncing LoRAs for user ${userId}...`);
      
      // Check which user LoRAs are actually available in ComfyUI
      const response = await fetch(`${COMFYUI_URL}/object_info`);
      if (!response.ok) {
        throw new Error('Failed to fetch ComfyUI info');
      }
      
      const objectInfo = await response.json();
      const loraLoader = objectInfo.LoraLoaderModelOnly;
      const comfyUILoRAs = loraLoader?.input?.required?.lora_name?.[0] || [];
      
      const syncResults = [];
      
      for (const influencer of userInfluencers) {
        const isAvailable = comfyUILoRAs.includes(influencer.fileName);
        const newSyncStatus = isAvailable ? 'synced' : 'missing';
        
        // Update the influencer
        const updated = updateUserInfluencer(userId, influencer.id, {
          syncStatus: newSyncStatus,
          isActive: isAvailable
        });
        
        syncResults.push({
          id: influencer.id,
          fileName: influencer.fileName,
          displayName: influencer.displayName,
          isAvailable,
          syncStatus: newSyncStatus,
          previousStatus: influencer.syncStatus
        });
      }
      
      return NextResponse.json({
        success: true,
        syncResults,
        message: `Sync completed for user ${userId}`,
        summary: {
          total: syncResults.length,
          synced: syncResults.filter(r => r.isAvailable).length,
          missing: syncResults.filter(r => !r.isAvailable).length
        }
      });
    }
    
    if (action === 'refresh_comfyui_cache') {
      // Force ComfyUI to refresh its model cache
      try {
        const response = await fetch(`${COMFYUI_URL}/refresh`, {
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
export const revalidate = 30; // Cache for 30 seconds