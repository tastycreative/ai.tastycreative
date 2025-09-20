const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkImageStorage() {
  console.log('🔍 Checking GeneratedImage storage patterns...\n');

  try {
    // Get recent images (last 24 hours)
    const recentImages = await prisma.generatedImage.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        filename: true,
        data: true,
        s3Key: true,
        networkVolumePath: true,
        fileSize: true,
        createdAt: true
      }
    });

    console.log('📊 Recent Images (Last 24 hours):');
    console.log('================================');
    
    for (const image of recentImages) {
      const storageType = image.data ? 'DATABASE_BLOB' : 
                         image.s3Key ? 'S3_STORAGE' : 
                         image.networkVolumePath ? 'NETWORK_VOLUME' : 'UNKNOWN';
      
      const blobSize = image.data ? image.data.length : 0;
      
      console.log(`🖼️  ${image.filename}`);
      console.log(`   📅 Created: ${image.createdAt.toISOString()}`);
      console.log(`   💾 Storage: ${storageType}`);
      console.log(`   📦 File Size: ${image.fileSize || 'N/A'} bytes`);
      console.log(`   🗃️  Blob Size: ${blobSize} bytes`);
      console.log(`   🔑 S3 Key: ${image.s3Key || 'None'}`);
      console.log(`   📁 Network Path: ${image.networkVolumePath || 'None'}`);
      console.log('');
    }

    // Get storage summary
    const allImages = await prisma.generatedImage.findMany({
      select: {
        data: true,
        s3Key: true,
        networkVolumePath: true,
        createdAt: true
      }
    });

    const summary = {
      total: allImages.length,
      withBlobs: 0,
      withS3Keys: 0,
      withNetworkPaths: 0,
      totalBlobStorage: 0
    };

    for (const image of allImages) {
      if (image.data) {
        summary.withBlobs++;
        summary.totalBlobStorage += image.data.length;
      }
      if (image.s3Key) summary.withS3Keys++;
      if (image.networkVolumePath) summary.withNetworkPaths++;
    }

    console.log('📈 Storage Summary:');
    console.log('==================');
    console.log(`Total Images: ${summary.total}`);
    console.log(`With Database Blobs: ${summary.withBlobs} (${(summary.withBlobs/summary.total*100).toFixed(1)}%)`);
    console.log(`With S3 Keys: ${summary.withS3Keys} (${(summary.withS3Keys/summary.total*100).toFixed(1)}%)`);
    console.log(`With Network Paths: ${summary.withNetworkPaths} (${(summary.withNetworkPaths/summary.total*100).toFixed(1)}%)`);
    console.log(`Total Blob Storage: ${(summary.totalBlobStorage / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImageStorage();