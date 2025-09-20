const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function cleanupBlobData() {
  try {
    // Find images that have both S3 key and blob data (should be S3 optimized)
    const duplicatedImages = await prisma.generatedImage.findMany({
      where: {
        AND: [
          { s3Key: { not: null } },
          { data: { not: null } }
        ]
      }
    });
    
    console.log(`Found ${duplicatedImages.length} images with both S3 key and blob data`);
    
    for (const image of duplicatedImages) {
      console.log(`\n🔧 Optimizing image: ${image.filename}`);
      console.log(`   S3 Key: ${image.s3Key}`);
      console.log(`   Blob Size: ${image.data ? (image.data.length / (1024 * 1024)).toFixed(2) : 0} MB`);
      
      // Remove blob data since we have S3 key
      await prisma.generatedImage.update({
        where: { id: image.id },
        data: { data: null }
      });
      
      console.log(`   ✅ Removed blob data, kept S3 key`);
    }
    
    if (duplicatedImages.length > 0) {
      console.log(`\n🎉 Successfully optimized ${duplicatedImages.length} images`);
      console.log('💾 Database storage freed up');
    } else {
      console.log('\n✅ No images need optimization');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupBlobData();