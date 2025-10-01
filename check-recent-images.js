// check-recent-images.js - Check recent images for AWS S3 data
const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkRecentImages() {
  console.log('🔍 Checking recent images...');
  
  try {
    // Find recent images
    const recentImages = await prisma.generatedImage.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        filename: true,
        clerkId: true,
        jobId: true,
        awsS3Key: true,
        awsS3Url: true,
        s3Key: true,
        networkVolumePath: true,
        createdAt: true
      }
    });
    
    console.log(`📊 Found ${recentImages.length} recent images`);
    
    for (const image of recentImages) {
      console.log('\n📸 Image:', image.filename);
      console.log('   ID:', image.id);
      console.log('   Job ID:', image.jobId);
      console.log('   AWS S3 Key:', image.awsS3Key);
      console.log('   AWS S3 URL:', image.awsS3Url);
      console.log('   Legacy S3 Key:', image.s3Key);
      console.log('   Network Volume Path:', image.networkVolumePath);
      console.log('   Created:', image.createdAt);
      
      // Check what getBestImageUrl would return
      const bestUrl = image.awsS3Url || 
                     (image.awsS3Key ? `https://tastycreative.s3.amazonaws.com/${image.awsS3Key}` : null) ||
                     image.s3Key;
      console.log('   Best URL would be:', bestUrl);
    }
    
  } catch (error) {
    console.error('💥 Error checking images:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkRecentImages();