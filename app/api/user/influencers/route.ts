// app/api/user/influencers/route.ts - Main influencers API endpoints
import { NextRequest, NextResponse } from 'next/server';
import { getUserId, getUserInfluencers } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }

    console.log('📖 === FETCHING USER INFLUENCERS ===');
    console.log('👤 User ID:', userId);

    // Get user's influencers from database
    const influencers = await getUserInfluencers(userId);
    
    console.log(`✅ Found ${influencers.length} influencers for user ${userId}`);

    return NextResponse.json({
      success: true,
      influencers,
      metadata: {
        total: influencers.length,
        active: influencers.filter(inf => inf.isActive).length,
        synced: influencers.filter(inf => inf.syncStatus === 'synced').length,
        pending: influencers.filter(inf => inf.syncStatus === 'pending').length
      }
    });

  } catch (error) {
    console.error('💥 Error fetching influencers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch influencers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
