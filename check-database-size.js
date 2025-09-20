const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabaseSizes() {
  try {
    console.log('🔍 Checking database image data sizes...\n');
    
    // Get all generated images with their data sizes
    const images = await prisma.generatedImage.findMany({
      select: {
        id: true,
        filename: true,
        clerkId: true,
        fileSize: true,
        s3Key: true,
        networkVolumePath: true,
        data: true,
        createdAt: true,
        jobId: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20 // Get last 20 images
    });

    console.log(`📊 Found ${images.length} images in database\n`);

    let totalDataSize = 0;
    let imagesWithData = 0;
    let imagesWithS3 = 0;
    let imagesWithNetworkVolume = 0;

    images.forEach((image, index) => {
      const hasData = image.data !== null;
      const hasS3 = image.s3Key !== null;
      const hasNetworkVolume = image.networkVolumePath !== null;
      const dataSize = hasData ? Buffer.byteLength(image.data || '', 'utf8') : 0;
      
      if (hasData) {
        imagesWithData++;
        totalDataSize += dataSize;
      }
      
      if (hasS3) imagesWithS3++;
      if (hasNetworkVolume) imagesWithNetworkVolume++;

      console.log(`${index + 1}. ${image.filename}`);
      console.log(`   📁 Job ID: ${image.jobId}`);
      console.log(`   👤 User: ${image.clerkId}`);
      console.log(`   📏 File Size: ${image.fileSize ? formatBytes(image.fileSize) : 'N/A'}`);
      console.log(`   💾 Has DB Data: ${hasData ? 'YES (' + formatBytes(dataSize) + ')' : 'NO'}`);
      console.log(`   🗄️  S3 Key: ${hasS3 ? 'YES' : 'NO'}`);
      console.log(`   🌐 Network Volume: ${hasNetworkVolume ? 'YES' : 'NO'}`);
      console.log(`   📅 Created: ${image.createdAt.toLocaleString()}`);
      console.log('');
    });

    console.log('📈 SUMMARY:');
    console.log(`   Total images: ${images.length}`);
    console.log(`   Images with database data: ${imagesWithData}`);
    console.log(`   Images with S3 keys: ${imagesWithS3}`);
    console.log(`   Images with network volume paths: ${imagesWithNetworkVolume}`);
    console.log(`   Total database storage used: ${formatBytes(totalDataSize)}`);
    console.log('');

    // Check if we can safely remove database data for S3 images
    const s3ImagesWithData = images.filter(img => img.s3Key && img.data);
    if (s3ImagesWithData.length > 0) {
      console.log(`⚠️  Found ${s3ImagesWithData.length} images that have both S3 storage AND database data`);
      console.log(`   💰 Potential savings: ${formatBytes(s3ImagesWithData.reduce((sum, img) => sum + Buffer.byteLength(img.data || '', 'utf8'), 0))}`);
      console.log('   These images could have their database data removed since they\'re stored in S3.');
    }

    // Check recent images (last 5)
    console.log('\n🔍 RECENT IMAGES ANALYSIS:');
    const recentImages = images.slice(0, 5);
    recentImages.forEach((image, index) => {
      const hasData = image.data !== null;
      const hasS3 = image.s3Key !== null;
      const storageType = hasS3 ? 'S3' : hasData ? 'Database' : 'None';
      
      console.log(`${index + 1}. ${image.filename} - Storage: ${storageType}`);
      if (hasS3) {
        console.log(`   🔗 S3 Key: ${image.s3Key}`);
      }
      if (hasData) {
        const dataSize = Buffer.byteLength(image.data || '', 'utf8');
        console.log(`   💾 DB Data Size: ${formatBytes(dataSize)}`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

checkDatabaseSizes();