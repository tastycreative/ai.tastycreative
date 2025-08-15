// app/api/debug/check-images/route.ts - Debug image storage
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

    console.log('🔍 === DEBUG IMAGE STORAGE ===');
    console.log('👤 User ID:', clerkId);

    // Get raw database query
    const rawImages = await prisma.generatedImage.findMany({
      where: {
        clerkId: clerkId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      select: {
        id: true,
        filename: true,
        jobId: true,
        clerkId: true,
        createdAt: true,
        subfolder: true,
        type: true,
        data: true
      }
    });

    console.log(`📸 Found ${rawImages.length} images in database for user`);

    // Get recent generation jobs for comparison
    const recentJobs = await prisma.generationJob.findMany({
      where: {
        clerkId: clerkId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    console.log(`💼 Found ${recentJobs.length} recent jobs for user`);

    return NextResponse.json({
      success: true,
      data: {
        totalImages: rawImages.length,
        images: rawImages.map(img => ({
          id: img.id,
          filename: img.filename,
          jobId: img.jobId,
          createdAt: img.createdAt,
          hasJobId: !!img.jobId,
          hasData: !!img.data,
          dataSize: img.data ? `${Buffer.byteLength(img.data)} bytes` : 'No data'
        })),
        recentJobs: recentJobs,
        summary: {
          imagesWithJobId: rawImages.filter(img => img.jobId).length,
          imagesWithoutJobId: rawImages.filter(img => !img.jobId).length,
          completedJobs: recentJobs.filter(job => job.status === 'COMPLETED').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Debug image storage failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
