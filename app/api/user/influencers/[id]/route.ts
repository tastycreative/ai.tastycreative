// app/api/user/influencers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://211.21.50.84:15132';

// Helper to get user ID (implement your auth logic here)
function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'default-user';
}

// Import the influencers database from the main route
const influencersDb: Map<string, any[]> = new Map();

// GET /api/user/influencers/[id] - Get specific influencer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(request);
    const { id } = params;
    
    const userInfluencers = influencersDb.get(userId) || [];
    const influencer = userInfluencers.find(inf => inf.id === id);
    
    if (!influencer) {
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      influencer
    });
  } catch (error) {
    console.error('Error fetching influencer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch influencer' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/influencers/[id] - Update influencer
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(request);
    const { id } = params;
    const updates = await request.json();
    
    const userInfluencers = influencersDb.get(userId) || [];
    const influencerIndex = userInfluencers.findIndex(inf => inf.id === id);
    
    if (influencerIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }
    
    // Update the influencer
    const influencer = userInfluencers[influencerIndex];
    const updatedInfluencer = {
      ...influencer,
      ...updates,
      id, // Ensure ID doesn't change
      userId, // Ensure userId doesn't change
      updatedAt: new Date().toISOString()
    };
    
    userInfluencers[influencerIndex] = updatedInfluencer;
    influencersDb.set(userId, userInfluencers);
    
    console.log('Influencer updated:', id);
    
    return NextResponse.json({
      success: true,
      influencer: updatedInfluencer
    });
  } catch (error) {
    console.error('Error updating influencer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update influencer' },
      { status: 500 }
    );
  }
}

// DELETE /api/user/influencers/[id] - Delete influencer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(request);
    const { id } = params;
    
    const userInfluencers = influencersDb.get(userId) || [];
    const influencerIndex = userInfluencers.findIndex(inf => inf.id === id);
    
    if (influencerIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }
    
    const influencer = userInfluencers[influencerIndex];
    
    // Try to delete from ComfyUI as well
    try {
      console.log('Attempting to delete from ComfyUI:', influencer.fileName);
      
      // Note: ComfyUI doesn't have a standard delete API endpoint
      // You might need to implement a custom endpoint or use system calls
      // For now, we'll just log this and remove from our database
      
      // If you have a custom delete endpoint:
      // const deleteResponse = await fetch(`${COMFYUI_URL}/api/models/delete`, {
      //   method: 'DELETE',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ 
      //     filename: influencer.fileName, 
      //     type: 'lora' 
      //   })
      // });
      
      console.log('ComfyUI deletion not implemented - file may remain on server');
    } catch (comfyUIError) {
      console.error('Error deleting from ComfyUI:', comfyUIError);
      // Continue with local deletion even if ComfyUI deletion fails
    }
    
    // Remove from our database
    userInfluencers.splice(influencerIndex, 1);
    influencersDb.set(userId, userInfluencers);
    
    console.log('Influencer deleted from database:', id);
    
    return NextResponse.json({
      success: true,
      message: 'Influencer deleted successfully',
      deletedInfluencer: influencer
    });
  } catch (error) {
    console.error('Error deleting influencer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete influencer' },
      { status: 500 }
    );
  }
}

// POST /api/user/influencers/[id]/increment-usage - Increment usage count
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserId(request);
    const { id } = params;
    
    const userInfluencers = influencersDb.get(userId) || [];
    const influencerIndex = userInfluencers.findIndex(inf => inf.id === id);
    
    if (influencerIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Influencer not found' },
        { status: 404 }
      );
    }
    
    // Increment usage count
    userInfluencers[influencerIndex].usageCount = (userInfluencers[influencerIndex].usageCount || 0) + 1;
    userInfluencers[influencerIndex].lastUsedAt = new Date().toISOString();
    
    influencersDb.set(userId, userInfluencers);
    
    return NextResponse.json({
      success: true,
      usageCount: userInfluencers[influencerIndex].usageCount
    });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to increment usage' },
      { status: 500 }
    );
  }
}