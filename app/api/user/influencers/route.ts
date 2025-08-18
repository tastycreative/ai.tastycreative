// app/api/user/influencers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 Fetching influencers for user: ${userId}`);

    const influencers = await prisma.influencerLoRA.findMany({
      where: { clerkId: userId },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`✅ Found ${influencers.length} influencers`);

    // Map database fields to frontend interface
    const mappedInfluencers = influencers.map(influencer => ({
      id: influencer.id,
      userId: influencer.clerkId, // Map clerkId to userId for frontend compatibility
      name: influencer.name,
      displayName: influencer.displayName,
      fileName: influencer.fileName,
      originalFileName: influencer.originalFileName,
      fileSize: influencer.fileSize,
      uploadedAt: influencer.uploadedAt.toISOString(),
      description: influencer.description,
      thumbnailUrl: influencer.thumbnailUrl,
      isActive: influencer.isActive,
      usageCount: influencer.usageCount,
      // Map enum values to lowercase for frontend compatibility
      syncStatus: influencer.syncStatus?.toLowerCase() as "pending" | "synced" | "missing" | "error",
      lastUsedAt: influencer.lastUsedAt?.toISOString(),
      comfyUIPath: influencer.comfyUIPath
    }));

    return NextResponse.json({
      success: true,
      influencers: mappedInfluencers
    });

  } catch (error) {
    console.error('❌ Error fetching influencers:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch influencers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}