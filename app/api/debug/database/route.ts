// app/api/debug/database/route.ts - Debug database connection
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('🔍 Testing database connection for user:', clerkId);

    // Test basic database connection
    const userCount = await prisma.user.count();
    console.log('👥 Total users in database:', userCount);

    // Test video table
    const videoCount = await prisma.generatedVideo.count({
      where: { clerkId }
    });
    console.log('🎬 Videos for user:', videoCount);

    // Test job table
    const jobCount = await prisma.generationJob.count({
      where: { clerkId }
    });
    console.log('💼 Jobs for user:', jobCount);

    // Get recent jobs
    const recentJobs = await prisma.generationJob.findMany({
      where: { clerkId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        type: true,
        createdAt: true,
        comfyUIPromptId: true
      }
    });

    // Get recent videos
    const recentVideos = await prisma.generatedVideo.findMany({
      where: { clerkId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        filename: true,
        jobId: true,
        createdAt: true,
        fileSize: true
      }
    });

    return NextResponse.json({
      success: true,
      debug: {
        clerkId,
        totalUsers: userCount,
        userVideos: videoCount,
        userJobs: jobCount,
        recentJobs,
        recentVideos,
        databaseConnected: true
      }
    });

  } catch (error) {
    console.error('💥 Database debug error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        databaseConnected: false
      },
      { status: 500 }
    );
  }
}
