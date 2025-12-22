import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Count total images
    const totalImages = await prisma.generatedImage.count();
    console.log(`📊 Total images in database: ${totalImages}`);
    
    // Get recent images (last 10)
    const recentImages = await prisma.generatedImage.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clerkId: true,
        jobId: true,
        filename: true,
        fileSize: true,
        width: true,
        height: true,
        format: true,
        createdAt: true,
        data: true
      }
    });
    
    console.log(`📸 Recent images: ${recentImages.length}`);
    
    // Check for specific job
    const jobImages = await prisma.generatedImage.findMany({
      where: { jobId: 'txt2img_1758098099975_mtg3x97rb' },
      select: {
        id: true,
        filename: true,
        fileSize: true,
        createdAt: true,
        data: true
      }
    });
    
    console.log(`🎯 Images for specific job: ${jobImages.length}`);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      stats: {
        totalImages,
        recentImagesCount: recentImages.length,
        specificJobImages: jobImages.length
      },
      recentImages: recentImages.map(img => ({
        id: img.id,
        clerkId: img.clerkId,
        jobId: img.jobId,
        filename: img.filename,
        fileSize: img.fileSize,
        width: img.width,
        height: img.height,
        format: img.format,
        createdAt: img.createdAt,
        hasData: !!img.data
      })),
      specificJobImages: jobImages.map(img => ({
        id: img.id,
        filename: img.filename,
        fileSize: img.fileSize,
        createdAt: img.createdAt,
        hasData: !!img.data,
        dataSize: img.data ? img.data.length : 0
      }))
    });

  } catch (error) {
    console.error('❌ Database test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'No stack trace'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}