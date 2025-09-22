const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkRecentImages() {
  console.log('🔍 Checking recent images URL patterns...\n');
  
  const recentImages = await prisma.generatedImage.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      s3Key: true,
      networkVolumePath: true,
      createdAt: true
    }
  });

  console.log('📊 Recent 10 images:');
  let s3Count = 0;
  let networkCount = 0;
  
  recentImages.forEach((img, i) => {
    const hasS3 = !!img.s3Key;
    const hasNetwork = !!img.networkVolumePath;
    const shouldUseS3 = hasS3;
    
    if (hasS3) s3Count++;
    if (!hasS3 && hasNetwork) networkCount++;
    
    console.log(`${i+1}. ${img.filename}`);
    console.log(`   S3: ${hasS3 ? '✅' : '❌'} | Network: ${hasNetwork ? '✅' : '❌'} | Should use: ${shouldUseS3 ? 'S3' : 'Network'}`);
    
    if (hasS3) {
      const s3Url = `/api/images/s3/${encodeURIComponent(img.s3Key)}`;
      console.log(`   Correct URL: ${s3Url}`);
    } else if (hasNetwork) {
      console.log(`   Fallback URL: /api/images/${img.id}/network-volume`);
    }
    console.log('');
  });
  
  console.log(`📈 Summary:`);
  console.log(`   Should use S3: ${s3Count}/${recentImages.length}`);
  console.log(`   Should use Network: ${networkCount}/${recentImages.length}`);
  console.log(`   S3 optimization rate: ${((s3Count/recentImages.length)*100).toFixed(1)}%`);
  
  await prisma.$disconnect();
}

checkRecentImages().catch(console.error);