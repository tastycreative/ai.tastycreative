// app/api/user/influencers/[id]/route.ts - FIXED individual influencer management
import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserId, 
  getUserInfluencers, 
  updateUserInfluencer, 
  deleteUserInfluencer,
  findUserInfluencer,
  incrementInfluencerUsage 
} from '@/lib/database';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://209.53.88.242:14753';

// GET /api/user/influencers/[id] - Get specific influencer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    const { id } = await params;

    console.log('🔍 === GET INFLUENCER ===');
    console.log('👤 User:', userId);
    console.log('🆔 Influencer ID:', id);

    const influencer = await findUserInfluencer(userId, id);

    if (!influencer) {
      console.log('❌ Influencer not found');
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }

    console.log('✅ Influencer found:', influencer.fileName);

    return NextResponse.json({
      success: true,
      influencer,
      metadata: {
        retrieved: new Date().toISOString(),
        userId
      }
    });
  } catch (error) {
    console.error('💥 Error fetching influencer:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch influencer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PATCH /api/user/influencers/[id] - Update influencer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    const { id } = await params;
    const updates = await request.json();

    console.log('🔄 === UPDATE INFLUENCER ===');
    console.log('👤 User:', userId);
    console.log('🆔 Influencer ID:', id);
    console.log('📝 Updates:', updates);

    // Add timestamp to updates
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const updatedInfluencer = await updateUserInfluencer(userId, id, updatesWithTimestamp);

    if (!updatedInfluencer) {
      console.log('❌ Influencer not found for update');
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }

    console.log('✅ Influencer updated successfully');

    return NextResponse.json({
      success: true,
      influencer: updatedInfluencer,
      message: 'Influencer updated successfully',
      metadata: {
        updated: new Date().toISOString(),
        userId
      }
    });
  } catch (error) {
    console.error('💥 Error updating influencer:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update influencer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/user/influencers/[id] - Delete influencer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    const { id } = await params;

    console.log('🗑️ === DELETE INFLUENCER ===');
    console.log('👤 User:', userId);
    console.log('🆔 Influencer ID:', id);

    const influencer = await findUserInfluencer(userId, id);

    if (!influencer) {
      console.log('❌ Influencer not found for deletion');
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }

    console.log('📋 Influencer to delete:', {
      fileName: influencer.fileName,
      displayName: influencer.displayName,
      comfyUIPath: influencer.comfyUIPath
    });

    // Try to delete from ComfyUI as well
    try {
      console.log('🖥️ Attempting to delete from ComfyUI:', influencer.fileName);
      // ComfyUI deletion logic (if available) goes here
      // For now, just log
      console.log('⚠️ ComfyUI deletion not implemented - file may remain on server');
    } catch (comfyUIError) {
      console.error('💥 Error deleting from ComfyUI:', comfyUIError);
      // Continue with local deletion even if ComfyUI deletion fails
    }

    // Remove from our database using the shared database
    const deletedInfluencer = await deleteUserInfluencer(userId, id);

    if (!deletedInfluencer) {
      console.log('❌ Failed to delete from database');
      return NextResponse.json(
        { success: false, error: 'Failed to delete influencer from database' },
        { status: 500 }
      );
    }

    console.log('✅ Influencer deleted successfully from database');

    return NextResponse.json({
      success: true,
      message: 'Influencer deleted successfully',
      deletedInfluencer: {
        id: deletedInfluencer.id,
        fileName: deletedInfluencer.fileName,
        displayName: deletedInfluencer.displayName
      },
      metadata: {
        deleted: new Date().toISOString(),
        userId,
        note: 'File may still exist on ComfyUI server and require manual removal'
      }
    });
  } catch (error) {
    console.error('💥 Error deleting influencer:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete influencer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/user/influencers/[id] - Special actions (like increment usage)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    const { id } = await params;
    const { action } = await request.json();

    console.log('🎬 === INFLUENCER ACTION ===');
    console.log('👤 User:', userId);
    console.log('🆔 Influencer ID:', id);
    console.log('🎭 Action:', action);

    const influencer = await findUserInfluencer(userId, id);

    if (!influencer) {
      console.log('❌ Influencer not found for action');
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }

    if (action === 'increment_usage') {
      // Increment usage count
      const updatedInfluencer = await updateUserInfluencer(userId, id, {
        usageCount: (influencer.usageCount || 0) + 1,
        lastUsedAt: new Date().toISOString()
      });

      console.log('📈 Usage incremented:', `${influencer.usageCount || 0} → ${(influencer.usageCount || 0) + 1}`);

      return NextResponse.json({
        success: true,
        action: 'increment_usage',
        usageCount: updatedInfluencer?.usageCount || 0,
        lastUsedAt: updatedInfluencer?.lastUsedAt,
        message: 'Usage count incremented'
      });
    }

    if (action === 'verify_comfyui') {
      // Verify if the influencer exists in ComfyUI
      try {
        console.log('🔍 Verifying influencer in ComfyUI...');

        const response = await fetch(`${COMFYUI_URL}/object_info`, {
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const objectInfo = await response.json();
          const loraLoader = objectInfo.LoraLoaderModelOnly;
          const availableLoRAs = loraLoader?.input?.required?.lora_name?.[0] || [];

          const isAvailable = availableLoRAs.includes(influencer.fileName);
          console.log('🎯 Verification result:', isAvailable);

          // Update sync status based on verification
          const newSyncStatus = isAvailable ? 'synced' : 'missing';
          const updatedInfluencer = await updateUserInfluencer(userId, id, {
            syncStatus: newSyncStatus,
            isActive: isAvailable
          });

          return NextResponse.json({
            success: true,
            action: 'verify_comfyui',
            isAvailable,
            syncStatus: newSyncStatus,
            influencer: updatedInfluencer,
            message: isAvailable ? 'Influencer verified in ComfyUI' : 'Influencer not found in ComfyUI'
          });
        } else {
          throw new Error(`ComfyUI responded with status: ${response.status}`);
        }
      } catch (verifyError) {
        console.error('💥 ComfyUI verification error:', verifyError);
        return NextResponse.json({
          success: false,
          action: 'verify_comfyui',
          error: 'Failed to verify with ComfyUI',
          details: verifyError instanceof Error ? verifyError.message : 'Unknown error'
        });
      }
    }

    if (action === 'toggle_active') {
      // Toggle active status
      const newActiveStatus = !influencer.isActive;
      const updatedInfluencer = await updateUserInfluencer(userId, id, {
        isActive: newActiveStatus
      });

      console.log('🔄 Active status toggled:', `${influencer.isActive} → ${newActiveStatus}`);

      return NextResponse.json({
        success: true,
        action: 'toggle_active',
        isActive: newActiveStatus,
        influencer: updatedInfluencer,
        message: `Influencer ${newActiveStatus ? 'activated' : 'deactivated'}`
      });
    }

    console.log('❌ Unknown action:', action);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unknown action',
        availableActions: ['increment_usage', 'verify_comfyui', 'toggle_active']
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('💥 Error performing influencer action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Action failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}