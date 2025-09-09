import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`🔍 Debug: Fetching influencers for user ${userId}`);

    // Get all influencer records for this user
    const influencers = await prisma.influencerLoRA.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: {
        uploadedAt: "desc",
      },
    });

    console.log(`📋 Found ${influencers.length} influencer records`);
    
    // Log each record for debugging
    influencers.forEach((inf, index) => {
      console.log(`${index + 1}. ${inf.displayName} - ${inf.fileName} (${inf.syncStatus})`);
    });

    return NextResponse.json({
      success: true,
      user_id: userId,
      total_influencers: influencers.length,
      influencers: influencers.map(inf => ({
        id: inf.id,
        displayName: inf.displayName,
        fileName: inf.fileName,
        originalFileName: inf.originalFileName,
        fileSize: inf.fileSize,
        syncStatus: inf.syncStatus,
        uploadedAt: inf.uploadedAt,
        comfyUIPath: inf.comfyUIPath,
        isActive: inf.isActive,
      })),
      raw_data: influencers, // Full data for debugging
    });

  } catch (error) {
    console.error("❌ Debug fetch error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Debug fetch failed',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
