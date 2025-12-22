import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    console.log(`🔍 DEBUG: Checking job ${jobId} in database`);
    
    // Check if job exists
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        images: true,
        _count: {
          select: { images: true }
        }
      }
    });
    
    if (!job) {
      return NextResponse.json({
        success: false,
        error: 'Job not found in database',
        jobId
      });
    }
    
    // Get detailed image information
    const imageDetails = job.images.map(img => ({
      id: img.id,
      filename: img.filename,
      subfolder: img.subfolder,
      type: img.type,
      fileSize: img.fileSize,
      width: img.width,
      height: img.height,
      format: img.format,
      hasData: !!img.data,
      dataSize: img.data ? img.data.length : 0,
      createdAt: img.createdAt
    }));
    
    console.log(`📊 Job ${jobId} found:`, {
      status: job.status,
      progress: job.progress,
      imageCount: job._count.images,
      stage: job.stage,
      message: job.message,
      resultUrls: job.resultUrls
    });
    
    console.log(`📊 Full job object keys:`, Object.keys(job));
    
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        clerkId: job.clerkId,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        message: job.message,
        elapsedTime: job.elapsedTime,
        estimatedTimeRemaining: job.estimatedTimeRemaining,
        resultUrls: job.resultUrls,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        lastChecked: job.lastChecked
      },
      imageCount: job._count.images,
      images: imageDetails
    });

  } catch (error) {
    console.error('❌ Database check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}