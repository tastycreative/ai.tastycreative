const { PrismaClient } = require('./lib/generated/prisma');
const prisma = new PrismaClient();

async function checkLatestImage() {
  try {
    const image = await prisma.generatedImage.findFirst({
      where: {
        job: { type: 'IMAGE_TO_IMAGE' }
      },
      include: { job: true },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!image) {
      console.log('No style transfer images found');
      return;
    }
    
    console.log('Latest style transfer image:');
    console.log('Filename:', image.filename);
    console.log('Has S3 Key:', !!image.s3Key);
    console.log('Has Blob Data:', !!image.data);
    console.log('S3 Key:', image.s3Key);
    console.log('File Size:', image.fileSize);
    console.log('Created:', image.createdAt);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestImage();