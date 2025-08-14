// app/api/user/influencers/upload-token/route.ts - Simple token generation for client uploads
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Upload token request received');
    
    // Authenticate the user
    const userId = await getUserId(request);
    if (!userId) {
      console.error('❌ No user ID found during authentication');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🎫 Generating upload token for user:', userId);
    
    // For client-side uploads, we just need to return success
    // The upload() function will handle the blob storage directly
    return NextResponse.json({ 
      success: true,
      userId: userId
    });

  } catch (error) {
    console.error('❌ Error in upload token handler:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Upload token generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
