// migrate-videos-to-aws-s3.js - Migrate existing videos to AWS S3
const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function migrateVideosToAWSS3() {
  console.log('🚀 Starting video migration to AWS S3...');
  
  try {
    // Find all videos without AWS S3 data
    const videosWithoutAWS = await prisma.generatedVideo.findMany({
      where: {
        OR: [
          { awsS3Key: null },
          { awsS3Url: null }
        ]
      },
      select: {
        id: true,
        filename: true,
        clerkId: true,
        jobId: true
      }
    });
    
    console.log(`📊 Found ${videosWithoutAWS.length} videos without AWS S3 data`);
    
    if (videosWithoutAWS.length === 0) {
      console.log('✅ All videos already have AWS S3 data');
      return;
    }
    
    let migrated = 0;
    
    for (const video of videosWithoutAWS) {
      try {
        // Generate AWS S3 key for the video
        const awsS3Key = `videos/${video.filename}`;
        const awsS3Url = `https://tastycreative.s3.amazonaws.com/${awsS3Key}`;
        
        console.log(`📤 Migrating video: ${video.filename}`);
        console.log(`   AWS S3 Key: ${awsS3Key}`);
        console.log(`   AWS S3 URL: ${awsS3Url}`);
        
        // Update the video with AWS S3 data
        await prisma.generatedVideo.update({
          where: { id: video.id },
          data: {
            awsS3Key,
            awsS3Url
          }
        });
        
        migrated++;
        console.log(`✅ Migrated ${video.filename}`);
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to migrate video ${video.filename}:`, error);
      }
    }
    
    console.log(`🎉 Migration complete! Migrated ${migrated}/${videosWithoutAWS.length} videos`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateVideosToAWSS3();