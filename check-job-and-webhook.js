// Check the most recent job and see what webhooks were received
const { PrismaClient } = require('./lib/generated/prisma');

async function checkJobDebug() {
  const prisma = new PrismaClient();
  
  try {
    // Get the most recent text-to-image job
    const latestJob = await prisma.generationJob.findFirst({
      where: { type: 'TEXT_TO_IMAGE' },
      orderBy: { createdAt: 'desc' },
      include: {
        images: {
          select: {
            id: true,
            filename: true,
            clerkId: true,
            awsS3Key: true,
            awsS3Url: true,
            s3Key: true,
            networkVolumePath: true,
            fileSize: true,
            createdAt: true
          }
        }
      }
    });

    if (!latestJob) {
      console.log('❌ No text-to-image jobs found');
      return;
    }

    console.log('\n💼 ===== LATEST JOB =====');
    console.log('Job ID:', latestJob.id);
    console.log('Job clerkId:', latestJob.clerkId);
    console.log('Status:', latestJob.status);
    console.log('Type:', latestJob.type);
    console.log('Created:', latestJob.createdAt);
    console.log('Progress:', latestJob.progress, '%');
    console.log('RunPod Job ID:', latestJob.comfyUIPromptId);
    
    console.log('\n📸 ===== IMAGES (' + latestJob.images.length + ') =====');
    latestJob.images.forEach((img, idx) => {
      console.log(`\n  Image ${idx + 1}:`);
      console.log('    ID:', img.id);
      console.log('    Filename:', img.filename);
      console.log('    clerkId:', img.clerkId);
      console.log('    awsS3Key:', img.awsS3Key || '❌ NULL');
      console.log('    awsS3Url:', img.awsS3Url || '❌ NULL');
      console.log('    s3Key:', img.s3Key || 'null');
      console.log('    networkVolumePath:', img.networkVolumePath || 'null');
      console.log('    fileSize:', img.fileSize);
      console.log('    Created:', img.createdAt);
    });
    
    console.log('\n🔍 ===== ANALYSIS =====');
    console.log('Job has images:', latestJob.images.length > 0 ? '✅ YES' : '❌ NO');
    console.log('Job status is completed:', latestJob.status === 'COMPLETED' ? '✅ YES' : '❌ NO');
    
    if (latestJob.images.length > 0) {
      const hasS3Data = latestJob.images.some(img => img.awsS3Key || img.s3Key || img.networkVolumePath);
      console.log('Images have S3 data:', hasS3Data ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM!');
      
      const imageClerksMatch = latestJob.images.every(img => img.clerkId === latestJob.clerkId);
      console.log('All image clerkIds match job clerkId:', imageClerksMatch ? '✅ YES' : '⚠️ NO - Mixed ownership');
    }
    
    console.log('\n========================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJobDebug();
