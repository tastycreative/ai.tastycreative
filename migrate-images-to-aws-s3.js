// migrate-images-to-aws-s3.js - Migrate existing images to AWS S3
const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function migrateImagesToAWSS3() {
  console.log('🚀 Starting image migration to AWS S3...');
  
  try {
    // Find all images without AWS S3 data
    const imagesWithoutAWS = await prisma.generatedImage.findMany({
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
        jobId: true,
        awsS3Key: true,
        awsS3Url: true
      }
    });
    
    console.log(`📊 Found ${imagesWithoutAWS.length} images without AWS S3 data`);
    
    if (imagesWithoutAWS.length === 0) {
      console.log('✅ All images already have AWS S3 data');
      return;
    }
    
    let migrated = 0;
    
    for (const image of imagesWithoutAWS) {
      try {
        // Generate AWS S3 key for the image
        const awsS3Key = `images/${image.filename}`;
        const awsS3Url = `https://tastycreative.s3.amazonaws.com/${awsS3Key}`;
        
        console.log(`📤 Migrating image: ${image.filename}`);
        console.log(`   AWS S3 Key: ${awsS3Key}`);
        console.log(`   AWS S3 URL: ${awsS3Url}`);
        
        // Update the image with AWS S3 data
        await prisma.generatedImage.update({
          where: { id: image.id },
          data: {
            awsS3Key,
            awsS3Url
          }
        });
        
        migrated++;
        console.log(`✅ Migrated ${image.filename}`);
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to migrate image ${image.filename}:`, error);
      }
    }
    
    console.log(`🎉 Migration complete! Migrated ${migrated}/${imagesWithoutAWS.length} images`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateImagesToAWSS3();