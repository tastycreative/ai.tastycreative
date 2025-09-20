import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Database diagnostic check requested');
    
    // Get overall database statistics
    const [totalImages, imagesWithData, totalSize, recentImages] = await Promise.all([
      prisma.generatedImage.count(),
      prisma.generatedImage.count({
        where: { 
          data: { not: null }
        }
      }),
      prisma.generatedImage.aggregate({
        _sum: { fileSize: true }
      }),
      prisma.generatedImage.findMany({
        select: {
          id: true,
          filename: true,
          fileSize: true,
          s3Key: true,
          networkVolumePath: true,
          data: true,
          createdAt: true,
          jobId: true,
          clerkId: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    // Analyze storage patterns
    let s3Images = 0;
    let networkVolumeImages = 0;
    let databaseOnlyImages = 0;
    let redundantImages = 0;
    let totalDataSize = 0;

    recentImages.forEach(image => {
      const hasS3 = image.s3Key !== null;
      const hasNetworkVolume = image.networkVolumePath !== null;
      const hasData = image.data !== null;
      
      if (hasS3) s3Images++;
      if (hasNetworkVolume) networkVolumeImages++;
      if (!hasS3 && !hasNetworkVolume && hasData) databaseOnlyImages++;
      if ((hasS3 || hasNetworkVolume) && hasData) redundantImages++;
      
      if (hasData) {
        totalDataSize += Buffer.byteLength(image.data || '', 'utf8');
      }
    });

    const analysis = {
      totalImages: totalImages || 0,
      imagesWithDatabaseData: imagesWithData || 0,
      imagesWithoutDatabaseData: (totalImages || 0) - (imagesWithData || 0),
      totalFileSize: totalSize._sum.fileSize || 0,
      recentImagesAnalysis: {
        total: recentImages.length,
        withS3: s3Images,
        withNetworkVolume: networkVolumeImages,
        databaseOnly: databaseOnlyImages,
        redundantStorage: redundantImages,
        totalDatabaseDataSize: totalDataSize
      },
      recentImages: recentImages.map(img => ({
        filename: img.filename,
        fileSize: img.fileSize,
        hasS3: img.s3Key !== null,
        hasNetworkVolume: img.networkVolumePath !== null,
        hasDatabaseData: img.data !== null,
        databaseDataSize: img.data ? Buffer.byteLength(img.data, 'utf8') : 0,
        createdAt: img.createdAt,
        storageType: img.s3Key ? 'S3' : img.networkVolumePath ? 'Network Volume' : img.data ? 'Database' : 'None'
      })),
      recommendations: [] as string[]
    };

    // Add recommendations
    if (redundantImages > 0) {
      analysis.recommendations.push(`${redundantImages} recent images have both S3/Network Volume AND database storage - consider removing database data`);
    }
    
    if (databaseOnlyImages > 0) {
      analysis.recommendations.push(`${databaseOnlyImages} recent images only use database storage - consider migrating to S3`);
    }
    
    if (s3Images > 0 || networkVolumeImages > 0) {
      analysis.recommendations.push(`Good: ${s3Images + networkVolumeImages} recent images use optimal S3/Network Volume storage`);
    }

    console.log('📊 Database analysis completed:', {
      totalImages: analysis.totalImages,
      imagesWithData: analysis.imagesWithDatabaseData,
      redundantStorage: analysis.recentImagesAnalysis.redundantStorage
    });

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('❌ Database diagnostic error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}