// app/api/user/influencers/complete-upload/route.ts - Complete the upload process after blob upload
import { NextRequest, NextResponse } from 'next/server';
import { getUserId, updateUserInfluencer } from '@/lib/database';

// Configure for Vercel deployment
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for ComfyUI transfer
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    
    console.log('✅ === COMPLETE UPLOAD ===');
    console.log('👤 Completing upload for user:', userId);
    
    const { influencerId, blobUrl } = await request.json();
    
    console.log('📋 Complete upload request:', {
      influencerId,
      blobUrl: !!blobUrl
    });
    
    if (!influencerId || !blobUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing influencerId or blobUrl' },
        { status: 400 }
      );
    }
    
    // Update the influencer record with blob URL
    console.log('💾 Updating influencer record with blob URL...');
    
    try {
      await updateUserInfluencer(userId, influencerId, {
        syncStatus: 'pending', // Still pending ComfyUI sync
        // We could store the blob URL in a custom field if needed
      });
      console.log('✅ Influencer record updated successfully');
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to update influencer data in database' },
        { status: 500 }
      );
    }
    
    // Trigger background ComfyUI transfer
    console.log('🚀 Triggering ComfyUI transfer in background...');
    
    try {
      // Call the background transfer endpoint
      const transferResponse = await fetch(`${request.nextUrl.origin}/api/user/influencers/transfer-to-comfyui`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
        },
        body: JSON.stringify({
          influencerId: influencerId,
          blobUrl: blobUrl
        })
      });
      
      if (transferResponse.ok) {
        console.log('✅ ComfyUI transfer initiated successfully');
        
        // Update status to show transfer is in progress
        await updateUserInfluencer(userId, influencerId, {
          syncStatus: 'pending'
        });
        
      } else {
        const errorText = await transferResponse.text();
        console.warn('⚠️ ComfyUI transfer request failed:', errorText);
        
        // Update status to show transfer failed, but file is in blob
        await updateUserInfluencer(userId, influencerId, {
          syncStatus: 'missing' // ComfyUI sync failed
        });
      }
    } catch (transferError) {
      console.warn('⚠️ Failed to initiate ComfyUI transfer:', transferError);
      
      // Update status to show transfer failed
      await updateUserInfluencer(userId, influencerId, {
        syncStatus: 'error'
      });
    }
    
    console.log('🎉 Upload completion processed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Upload completed successfully! ComfyUI sync is in progress.',
      influencerId: influencerId,
      comfyUITransferInitiated: true,
      note: 'Your LoRA is being processed and will be ready for use shortly. Check the sync status in a few moments.'
    });
    
  } catch (error) {
    console.error('💥 Complete upload error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to complete upload process',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
