import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  getUserInfluencers, 
  addUserInfluencer, 
  getUserId,
  type InfluencerLoRA 
} from '@/lib/database';

// GET /api/user/influencers - Fetch user's influencers
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    console.log('➕ === USER INFLUENCERS POST ===');
    console.log('👤 Fetching influencers for user:', userId);
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Use the shared database instance
    const userInfluencers = await getUserInfluencers(userId) || []; // FIX: await here
    
    console.log(`📊 Found ${userInfluencers.length} influencers for user ${userId}`);
    
    if (userInfluencers.length > 0) {
      console.log('📋 Influencer summary:');
      const statusCounts = userInfluencers.reduce((acc, inf) => {
        acc[inf.syncStatus || 'unknown'] = (acc[inf.syncStatus || 'unknown'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('📊 Status breakdown:', statusCounts);
      
      const activeCounts = {
        active: userInfluencers.filter(inf => inf.isActive).length,
        inactive: userInfluencers.filter(inf => !inf.isActive).length
      };
      console.log('📊 Active breakdown:', activeCounts);
    }
    
    // Sort by most recent first
    const sortedInfluencers = userInfluencers.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    
    const response = {
      success: true,
      influencers: sortedInfluencers,
      metadata: {
        total: sortedInfluencers.length,
        active: sortedInfluencers.filter(inf => inf.isActive).length,
        synced: sortedInfluencers.filter(inf => inf.syncStatus === 'synced').length,
        userId,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Returning influencers data successfully');
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('💥 Error fetching user influencers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch influencers',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/user/influencers - Create new influencer (metadata only)
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: No user ID found' },
        { status: 401 }
      );
    }
    console.log('➕ === USER INFLUENCERS POST ===');
    console.log('👤 Creating influencer for user:', userId);

    const { displayName, description, fileName, fileSize, comfyUIPath } = await request.json();
    console.log('📋 Influencer data:', {
      displayName,
      fileName,
      fileSize,
      comfyUIPath: !!comfyUIPath
    });

    if (!displayName || !fileName) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Display name and file name are required' },
        { status: 400 }
      );
    }

    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      clerkId: userId, // userId is guaranteed to be string here
      name: fileName.replace(/\.[^/.]+$/, ""),
      displayName,
      fileName,
      originalFileName: fileName,
      fileSize: fileSize || 0,
      uploadedAt: new Date().toISOString(),
      description: description || '',
      isActive: true,
      usageCount: 0,
      comfyUIPath,
      syncStatus: 'pending'
    };

    console.log('💾 Adding influencer to database:', influencer.id);

    await addUserInfluencer(userId, influencer);

    console.log('✅ Influencer created successfully:', influencer.id);

    return NextResponse.json({
      success: true,
      influencer,
      message: 'Influencer created successfully'
    });
  } catch (error) {
    console.error('💥 Error creating influencer:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create influencer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}