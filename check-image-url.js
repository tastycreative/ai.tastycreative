const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkImageUrl() {
  const image = await prisma.generatedImage.findUnique({
    where: { id: 'cmfv3edk6000rl5040j2aygdl' }
  });
  
  if (image) {
    // Simulate the URL logic from imageStorage.ts
    const url = image.s3Key ? 
      `/api/images/s3/${encodeURIComponent(image.s3Key)}` :
      image.networkVolumePath ? 
      `/api/images/${image.id}/network-volume` : 
      'no-url';
    
    console.log('🔍 Image URL logic:');
    console.log('Has S3 key:', !!image.s3Key);
    console.log('Has network path:', !!image.networkVolumePath);
    console.log('Should use URL:', url);
    console.log('Expected S3 URL:', `/api/images/s3/${encodeURIComponent(image.s3Key)}`);
  }
  
  await prisma.$disconnect();
}

checkImageUrl().catch(console.error);