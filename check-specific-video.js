// check-specific-video.js - Check AWS S3 data for specific video
const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkSpecificVideo() {
  console.log('🔍 Checking specific video data...');
  
  try {
    const filename = 'wan2_video_img2vid_1759304518388_s2aia6i3j_1759304524244_00001_.mp4';
    
    // Find the video by filename
    const video = await prisma.generatedVideo.findFirst({
      where: {
        filename: filename
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
    
    if (!video) {
      console.log('❌ Video not found:', filename);
      return;
    }
    
    console.log('📹 Video found:');
    console.log('   ID:', video.id);
    console.log('   Filename:', video.filename);
    console.log('   Clerk ID:', video.clerkId);
    console.log('   Job ID:', video.jobId);
    console.log('   AWS S3 Key:', video.awsS3Key);
    console.log('   AWS S3 URL:', video.awsS3Url);
    console.log('   Legacy S3 Key:', video.s3Key);
    console.log('   Network Volume Path:', video.networkVolumePath);
    console.log('   Created At:', video.createdAt);
    
    // Check if AWS S3 data exists
    if (!video.awsS3Key && !video.awsS3Url) {
      console.log('⚠️ No AWS S3 data found for this video');
      
      // Populate AWS S3 data
      const awsS3Key = `videos/${video.filename}`;
      const awsS3Url = `https://tastycreative.s3.amazonaws.com/${awsS3Key}`;
      
      console.log('🔧 Populating AWS S3 data:');
      console.log('   New AWS S3 Key:', awsS3Key);
      console.log('   New AWS S3 URL:', awsS3Url);
      
      const updated = await prisma.generatedVideo.update({
        where: { id: video.id },
        data: {
          awsS3Key,
          awsS3Url
        }
      });
      
      console.log('✅ Updated video with AWS S3 data');
    } else {
      console.log('✅ Video already has AWS S3 data');
    }
    
  } catch (error) {
    console.error('💥 Error checking video:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkSpecificVideo();