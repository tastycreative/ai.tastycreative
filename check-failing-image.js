const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkImage() {
  const image = await prisma.generatedImage.findUnique({
    where: { id: 'cmfv3edk6000rl5040j2aygdl' },
    select: {
      id: true,
      filename: true,
      s3Key: true,
      networkVolumePath: true,
      data: true,
      createdAt: true
    }
  });
  
  console.log('🔍 Image record:', image);
  console.log('Has S3 key:', !!image?.s3Key);
  console.log('Has network volume path:', !!image?.networkVolumePath);
  console.log('Has blob data:', !!image?.data);
  
  if (image?.s3Key) {
    console.log('S3 key:', image.s3Key);
  }
  if (image?.networkVolumePath) {
    console.log('Network volume path:', image.networkVolumePath);
  }
  
  await prisma.$disconnect();
}

checkImage().catch(console.error);