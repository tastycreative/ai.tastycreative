// app/api/user/influencers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Types
interface InfluencerLoRA {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  usageCount: number;
  comfyUIPath?: string; // Path in ComfyUI models/loras directory
}

// In-memory storage (use database in production)
const influencersDb: Map<string, InfluencerLoRA[]> = new Map();

// Helper to get user ID (implement your auth logic here)
function getUserId(request: NextRequest): string {
  // For demo purposes, using a header or default user
  return request.headers.get('x-user-id') || 'default-user';
}

// GET /api/user/influencers - Fetch user's influencers
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const userInfluencers = influencersDb.get(userId) || [];
    
    return NextResponse.json({
      success: true,
      influencers: userInfluencers
    });
  } catch (error) {
    console.error('Error fetching user influencers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch influencers' },
      { status: 500 }
    );
  }
}

// POST /api/user/influencers - Create new influencer (metadata only)
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { displayName, description, fileName, fileSize, comfyUIPath } = await request.json();
    
    if (!displayName || !fileName) {
      return NextResponse.json(
        { success: false, error: 'Display name and file name are required' },
        { status: 400 }
      );
    }
    
    const influencer: InfluencerLoRA = {
      id: uuidv4(),
      userId,
      name: fileName.replace(/\.[^/.]+$/, ""), // Remove extension
      displayName,
      fileName,
      fileSize: fileSize || 0,
      uploadedAt: new Date().toISOString(),
      description,
      isActive: true,
      usageCount: 0,
      comfyUIPath
    };
    
    const userInfluencers = influencersDb.get(userId) || [];
    userInfluencers.push(influencer);
    influencersDb.set(userId, userInfluencers);
    
    return NextResponse.json({
      success: true,
      influencer
    });
  } catch (error) {
    console.error('Error creating influencer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create influencer' },
      { status: 500 }
    );
  }
}