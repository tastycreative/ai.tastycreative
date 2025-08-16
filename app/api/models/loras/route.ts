// app/api/models/loras/route.ts - Complete updated version
import { NextRequest, NextResponse } from 'next/server';
import { getUserId, getUserInfluencers, updateUserInfluencer } from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15279';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    console.log('🎨 === LoRA MODELS API ===');
    console.log('👤 Fetching LoRAs for user:', userId);
    console.log('🖥️ ComfyUI URL:', COMFYUI_URL);

    // Get user's influencers from shared database
    const userInfluencersRaw = await getUserInfluencers(userId);
    const userInfluencers = Array.isArray(userInfluencersRaw) ? userInfluencersRaw : [];
    console.log('📊 Total user influencers in database:', userInfluencers.length);

    if (userInfluencers.length > 0) {
      console.log('📋 Sample influencer:', {
        id: userInfluencers[0].id,
        fileName: userInfluencers[0].fileName,
        displayName: userInfluencers[0].displayName,
        syncStatus: userInfluencers[0].syncStatus,
        isActive: userInfluencers[0].isActive
      });
    }

    const activeInfluencers = userInfluencers.filter(inf => inf.isActive && inf.syncStatus === 'synced');
    console.log('✅ Active + synced influencers:', activeInfluencers.length);

    // Convert to the format expected by the text-to-image component
    // UPDATED: Return objects with both fileName and displayName
    const userLoRAModels = activeInfluencers.map(inf => ({
      fileName: inf.fileName,
      displayName: inf.displayName,
      name: inf.name
    }));
    
    console.log('📁 User LoRA models:', userLoRAModels);

    // Always include "None" option for base model
    let availableLoRAs = [
      { fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' },
      ...userLoRAModels
    ];
    console.log('📝 Initial available LoRAs:', availableLoRAs);

    // Verify that the LoRAs actually exist in ComfyUI
    let comfyUILoRAs: string[] = [];
    let comfyUIAccessible = false;
    let comfyUIError = null;

    try {
      console.log('🔌 Attempting to connect to ComfyUI at:', `${COMFYUI_URL}/object_info`);

      // Add authentication for RunPod/ComfyUI server
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      
      const runpodApiKey = process.env.RUNPOD_API_KEY;
      if (runpodApiKey) {
        headers['Authorization'] = `Bearer ${runpodApiKey}`;
      }

      const response = await fetch(`${COMFYUI_URL}/object_info`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      console.log('📡 ComfyUI response status:', response.status);
      console.log('📋 ComfyUI response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const objectInfo = await response.json();
        console.log('🔍 ComfyUI object_info keys count:', Object.keys(objectInfo).length);

        const loraLoader = objectInfo.LoraLoaderModelOnly;
        console.log('🎯 LoraLoaderModelOnly found:', !!loraLoader);

        if (loraLoader?.input?.required?.lora_name?.[0]) {
          comfyUILoRAs = loraLoader.input.required.lora_name[0];
          comfyUIAccessible = true;
          console.log('📊 ComfyUI available LoRAs count:', comfyUILoRAs.length);
          console.log('📁 ComfyUI LoRAs sample:', comfyUILoRAs.slice(0, 5));

          // Filter user LoRAs to only include those actually available in ComfyUI
          const verifiedUserLoRAs = [];
          const syncUpdates = [];

          for (const influencer of userInfluencers) {
            const isAvailableInComfyUI = comfyUILoRAs.includes(influencer.fileName);
            console.log(`🔍 Checking ${influencer.fileName}: ${isAvailableInComfyUI ? '✅ FOUND' : '❌ NOT FOUND'} in ComfyUI`);

            if (isAvailableInComfyUI) {
              verifiedUserLoRAs.push({
                fileName: influencer.fileName,
                displayName: influencer.displayName,
                name: influencer.name
              });

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

          console.log('✅ Verified user LoRAs:', verifiedUserLoRAs);
          console.log('🔄 Sync updates needed:', syncUpdates.length);

          // Apply sync updates
          for (const update of syncUpdates) {
            await updateUserInfluencer(userId, update.id, update.updates);
          }

          availableLoRAs = [
            { fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' },
            ...verifiedUserLoRAs
          ];

          if (syncUpdates.length > 0) {
            console.log('🔄 Updated sync status for', syncUpdates.length, 'LoRAs');
          }
        } else {
          console.log('❌ LoraLoaderModelOnly structure not found in ComfyUI response');
          console.log('🔍 Available object types:', Object.keys(objectInfo).slice(0, 10));
          comfyUIError = 'LoraLoaderModelOnly not found in ComfyUI object_info';
        }
      } else {
        const errorText = await response.text();
        console.error('❌ ComfyUI request failed with status:', response.status);
        console.error('📄 ComfyUI error response:', errorText.substring(0, 500));
        comfyUIError = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
      }
    } catch (verificationError) {
      console.error('💥 Error connecting to ComfyUI:', verificationError);
      if (verificationError instanceof Error) {
        console.error('🔍 Error details:', {
          name: verificationError.name,
          message: verificationError.message,
          stack: verificationError.stack?.split('\n').slice(0, 3)
        });
        comfyUIError = verificationError.message;
      } else {
        comfyUIError = 'Unknown ComfyUI connection error';
      }
    }

    console.log('📝 Final available LoRAs:', availableLoRAs);
    console.log('🎨 === End LoRA Models API ===');

    const response = {
      success: true,
      models: availableLoRAs,
      userModelsCount: availableLoRAs.length - 1, // Exclude "None"
      totalInfluencers: userInfluencers.length,
      activeInfluencers: userInfluencers.filter(inf => inf.isActive).length,
      syncedInfluencers: userInfluencers.filter(inf => inf.syncStatus === 'synced').length,
      debug: {
        userId,
        comfyUIAccessible,
        comfyUILoRAsCount: comfyUILoRAs.length,
        userInfluencersCount: userInfluencers.length,
        comfyUIUrl: COMFYUI_URL,
        comfyUIError,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 === CRITICAL ERROR in LoRA Models API ===');
    console.error('Error fetching user LoRA models:', error);

    if (error instanceof Error) {
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      });
    }

    // Fallback response to ensure the UI doesn't break
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch LoRA models',
        details: error instanceof Error ? error.message : 'Unknown error',
        models: [{ fileName: 'None', displayName: 'No LoRA (Base Model)', name: 'none' }],
        userModelsCount: 0,
        debug: {
          comfyUIAccessible: false,
          comfyUIUrl: COMFYUI_URL,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

// POST endpoint for LoRA management actions
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 === LoRA MODELS API POST REQUEST ===');
    console.log('📍 Request URL:', request.url);
    console.log('🔧 Request method:', request.method);

    const contentType = request.headers.get('content-type');
    console.log('📋 Content-Type:', contentType);

    if (!contentType?.includes('application/json')) {
      console.error('❌ Invalid content type:', contentType);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid content type. Expected application/json.',
          receivedContentType: contentType
        },
        { status: 400 }
      );
    }

    let requestBody;
    try {
      requestBody = await request.json();
      console.log('📦 Request body:', requestBody);
    } catch (parseError) {
      console.error('💥 JSON parse error:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        },
        { status: 400 }
      );
    }

    const { action, userId: targetUserId } = requestBody;
    const requestingUserId = await getUserId(request);

    console.log('🎬 Action:', action);
    console.log('👤 Target user ID:', targetUserId);
    console.log('👤 Requesting user ID:', requestingUserId);

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing action parameter',
          availableActions: ['sync_user_loras', 'refresh_comfyui_cache']
        },
        { status: 400 }
      );
    }

    if (action === 'sync_user_loras') {
      // Sync a specific user's LoRAs with ComfyUI
      const userId = targetUserId || requestingUserId;
      const userInfluencersRaw = await getUserInfluencers(userId);
      const userInfluencers = Array.isArray(userInfluencersRaw) ? userInfluencersRaw : [];

      console.log(`🔄 Syncing LoRAs for user ${userId}...`);
      console.log('📊 User influencers to sync:', userInfluencers.length);

      if (userInfluencers.length === 0) {
        console.log('❌ No influencers found for user');
        return NextResponse.json({
          success: true,
          message: `No LoRA models found for user ${userId}`,
          syncResults: [],
          summary: {
            total: 0,
            synced: 0,
            missing: 0
          }
        });
      }

      // Check which user LoRAs are actually available in ComfyUI
      console.log('🔌 Connecting to ComfyUI for sync...');
      console.log('🖥️ ComfyUI URL:', COMFYUI_URL);

      try {
        const response = await fetch(`${COMFYUI_URL}/object_info`, {
          method: 'GET',
          signal: AbortSignal.timeout(15000) // 15 second timeout for sync
        });

        console.log('📡 ComfyUI object_info response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ ComfyUI sync request failed:', response.status, errorText);
          throw new Error(`Failed to fetch ComfyUI info: ${response.status} - ${errorText}`);
        }

        const objectInfo = await response.json();
        const loraLoader = objectInfo.LoraLoaderModelOnly;
        const comfyUILoRAs = loraLoader?.input?.required?.lora_name?.[0] || [];

        console.log('📊 ComfyUI LoRAs available for sync:', comfyUILoRAs.length);
        console.log('📁 Sample ComfyUI LoRAs:', comfyUILoRAs.slice(0, 5));

        const syncResults = [];

        for (const influencer of userInfluencers) {
          const isAvailable = comfyUILoRAs.includes(influencer.fileName);
          const newSyncStatus = isAvailable ? 'synced' : 'missing';

          console.log(`🔍 Syncing ${influencer.fileName}: ${isAvailable ? '✅ FOUND' : '❌ MISSING'}`);

          // Update the influencer
          const updated = await updateUserInfluencer(userId, influencer.id, {
            syncStatus: newSyncStatus,
            isActive: isAvailable
          });

          syncResults.push({
            id: influencer.id,
            fileName: influencer.fileName,
            displayName: influencer.displayName,
            isAvailable,
            syncStatus: newSyncStatus,
            previousStatus: influencer.syncStatus,
            updated: !!updated
          });
        }

        const summary = {
          total: syncResults.length,
          synced: syncResults.filter(r => r.isAvailable).length,
          missing: syncResults.filter(r => !r.isAvailable).length
        };

        console.log('✅ Sync completed. Results:', summary);

        return NextResponse.json({
          success: true,
          syncResults,
          message: `Sync completed for user ${userId}`,
          summary
        });

      } catch (comfyUIError) {
        console.error('💥 ComfyUI connection error during sync:', comfyUIError);
        return NextResponse.json({
          success: false,
          error: 'Failed to connect to ComfyUI during sync',
          details: comfyUIError instanceof Error ? comfyUIError.message : 'Unknown ComfyUI error',
          comfyUIUrl: COMFYUI_URL
        }, { status: 500 });
      }
    }

    if (action === 'refresh_comfyui_cache') {
      // Force ComfyUI to refresh its model cache
      try {
        console.log('🔄 Attempting to refresh ComfyUI cache...');
        const response = await fetch(`${COMFYUI_URL}/refresh`, {
          method: 'POST',
          signal: AbortSignal.timeout(10000)
        });

        console.log('📡 ComfyUI refresh response:', response.status);

        return NextResponse.json({
          success: response.ok,
          message: response.ok ? 'ComfyUI cache refreshed' : 'Failed to refresh cache',
          status: response.status
        });
      } catch (error) {
        console.error('💥 ComfyUI refresh error:', error);
        return NextResponse.json({
          success: false,
          message: 'ComfyUI refresh endpoint not available',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('❌ Unknown action received:', action);
    return NextResponse.json(
      {
        success: false,
        error: `Unknown action: ${action}`,
        receivedAction: action,
        availableActions: ['sync_user_loras', 'refresh_comfyui_cache']
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('💥 === CRITICAL ERROR in LoRA management action ===');
    console.error('Error details:', error);

    if (error instanceof Error) {
      console.error('🔍 Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Action failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Cache the results for better performance
export const revalidate = 30; // Cache for 30 seconds