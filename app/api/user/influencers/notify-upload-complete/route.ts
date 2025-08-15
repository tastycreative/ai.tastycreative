// app/api/user/influencers/notify-upload-complete/route.ts - Notify server that client-side upload is complete
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
    
    console.log('🔔 === UPLOAD COMPLETE NOTIFICATION ===');
    console.log('👤 Processing upload completion for user:', userId);
    
    const { influencerId, blobUrl, fileName } = await request.json();
    
    console.log('📋 Upload complete notification:', {
      influencerId,
      blobUrl: !!blobUrl,
      fileName
    });
    
    if (!influencerId || !blobUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing influencerId or blobUrl' },
        { status: 400 }
      );
    }
    
    console.log('💾 Updating influencer record...');
    
    try {
      // Update the influencer record to show upload is complete
      await updateUserInfluencer(userId, influencerId, {
        syncStatus: 'pending', // Still pending ComfyUI sync
        isActive: false // Will be activated after ComfyUI sync
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
          blobUrl: blobUrl,
          fileName: fileName
        })
      });
      
      let comfyUITransferSuccess = false;
      
      if (transferResponse.ok) {
        console.log('✅ ComfyUI transfer initiated successfully');
        comfyUITransferSuccess = true;
        
        // Update status to show transfer is in progress or completed
        await updateUserInfluencer(userId, influencerId, {
          syncStatus: 'synced',
          isActive: true,
          comfyUIPath: `models/loras/${fileName}`
        });
        
      } else {
        const errorText = await transferResponse.text();
        console.warn('⚠️ ComfyUI transfer request failed:', errorText);
        
        // Update status to show transfer failed, but file is in blob
        await updateUserInfluencer(userId, influencerId, {
          syncStatus: 'missing' // ComfyUI sync failed
        });
      }
      
      console.log('🎉 Upload completion processed successfully');
      
      return NextResponse.json({
        success: true,
        message: comfyUITransferSuccess 
          ? 'Upload completed successfully! Your LoRA is ready to use.' 
          : 'Upload completed successfully! Your LoRA is stored safely. ComfyUI sync will be retried.',
        influencerId: influencerId,
        comfyUITransferSuccess,
        note: comfyUITransferSuccess 
          ? 'Your LoRA model is now available in ComfyUI and ready for generation.'
          : 'Your LoRA is safely stored. Use the sync button to retry ComfyUI setup.'
      });
      
    } catch (transferError) {
      console.warn('⚠️ Failed to initiate ComfyUI transfer:', transferError);
      
      // Update status to show transfer failed
      await updateUserInfluencer(userId, influencerId, {
        syncStatus: 'error'
      });
      
      return NextResponse.json({
        success: true, // Still successful since file is uploaded
        message: 'Upload completed successfully! ComfyUI sync will be retried later.',
        influencerId: influencerId,
        comfyUITransferSuccess: false,
        error: 'ComfyUI transfer failed but file is safely stored',
        note: 'Your LoRA is safely stored in Vercel Blob. Use the sync button to retry ComfyUI setup.'
      });
    }
    
  } catch (error) {
    console.error('💥 Upload complete notification error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process upload completion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
