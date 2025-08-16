// app/api/debug/content/route.ts - Debug endpoint for Vercel deployment issues
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 === DEBUG CONTENT API ===');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('🔗 Database URL exists:', !!process.env.DATABASE_URL);
    console.log('🔑 Clerk keys exist:', {
      publishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: !!process.env.CLERK_SECRET_KEY,
    });

    // Check authentication
    const { userId: clerkId } = await auth();
    console.log('👤 Clerk ID from auth:', clerkId);
    
    if (!clerkId) {
      return NextResponse.json({
        success: false,
        error: 'No authentication',
        debug: {
          authenticated: false,
          clerkId: null,
          environment: process.env.NODE_ENV,
        }
      }, { status: 401 });
    }

    // Test database connection
    console.log('📡 Testing database connection...');
    let dbConnected = false;
    let dbError: string | null = null;
    
    try {
      await prisma.$connect();
      dbConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown DB error';
      console.error('❌ Database connection failed:', dbError);
    }

    // Count images and videos
    let imageCount = 0;
    let videoCount = 0;
    let imageError: string | null = null;
    let videoError: string | null = null;

    if (dbConnected) {
      try {
        imageCount = await prisma.generatedImage.count({
          where: { clerkId }
        });
        console.log('📊 Image count:', imageCount);
      } catch (error) {
        imageError = error instanceof Error ? error.message : 'Unknown image error';
        console.error('❌ Image count failed:', imageError);
      }

      try {
        videoCount = await prisma.generatedVideo.count({
          where: { clerkId }
        });
        console.log('📊 Video count:', videoCount);
      } catch (error) {
        videoError = error instanceof Error ? error.message : 'Unknown video error';
        console.error('❌ Video count failed:', videoError);
      }
    }

    // Sample a few records for debugging
    let sampleImages: any[] = [];
    let sampleVideos: any[] = [];

    if (dbConnected) {
      try {
        sampleImages = await prisma.generatedImage.findMany({
          where: { clerkId },
          select: {
            id: true,
            filename: true,
            subfolder: true,
            type: true,
            createdAt: true,
            jobId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
        console.log('📄 Sample images:', sampleImages.length);
      } catch (error) {
        console.error('❌ Sample images failed:', error);
      }

      try {
        sampleVideos = await prisma.generatedVideo.findMany({
          where: { clerkId },
          select: {
            id: true,
            filename: true,
            subfolder: true,
            type: true,
            createdAt: true,
            jobId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
        console.log('📄 Sample videos:', sampleVideos.length);
      } catch (error) {
        console.error('❌ Sample videos failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      debug: {
        environment: process.env.NODE_ENV,
        authenticated: true,
        clerkId,
        database: {
          connected: dbConnected,
          error: dbError,
        },
        content: {
          imageCount,
          videoCount,
          imageError,
          videoError,
          sampleImages,
          sampleVideos,
        },
        environment_vars: {
          hasDbUrl: !!process.env.DATABASE_URL,
          hasClerkKeys: {
            publishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
            secret: !!process.env.CLERK_SECRET_KEY,
          },
          nodeEnv: process.env.NODE_ENV,
        }
      }
    });

  } catch (error) {
    console.error('💥 Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        environment: process.env.NODE_ENV,
        authenticated: false,
      }
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
