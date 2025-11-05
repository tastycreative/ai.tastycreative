// Temporary debug script to check latest image record
const { PrismaClient } = require('./lib/generated/prisma');

async function checkLatestImage() {
  const prisma = new PrismaClient();
  
  try {
    // Get the most recent image
    const latestImage = await prisma.generatedImage.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            clerkId: true,
            firstName: true,
            lastName: true
          }
        },
        job: {
          select: {
            id: true,
            clerkId: true,
            type: true,
            status: true
          }
        }
      }
    });

    if (!latestImage) {
      console.log('❌ No images found in database');
      return;
    }

    console.log('\n🖼️ ===== LATEST IMAGE =====');
    console.log('Image ID:', latestImage.id);
    console.log('Filename:', latestImage.filename);
    console.log('Created:', latestImage.createdAt);
    console.log('\n👤 Owner:');
    console.log('  clerkId:', latestImage.clerkId);
    console.log('  Name:', latestImage.user?.firstName, latestImage.user?.lastName);
    console.log('\n💼 Job:');
    console.log('  Job ID:', latestImage.jobId);
    console.log('  Job Owner clerkId:', latestImage.job?.clerkId);
    console.log('  Type:', latestImage.job?.type);
    console.log('  Status:', latestImage.job?.status);
    console.log('\n📦 Storage:');
    console.log('  awsS3Key:', latestImage.awsS3Key || 'null');
    console.log('  awsS3Url:', latestImage.awsS3Url || 'null');
    console.log('  s3Key:', latestImage.s3Key || 'null');
    console.log('  networkVolumePath:', latestImage.networkVolumePath || 'null');
    console.log('  hasData:', latestImage.data ? 'YES' : 'NO');
    console.log('  fileSize:', latestImage.fileSize || 'null');
    console.log('\n✅ Match check:');
    console.log('  Image.clerkId === Job.clerkId?', latestImage.clerkId === latestImage.job?.clerkId ? '✅ YES' : '❌ NO');
    
    // Check folder shares if the owner is different
    if (latestImage.awsS3Key) {
      const match = latestImage.awsS3Key.match(/^outputs\/([^\/]+)\/([^\/]+)\//);
      if (match) {
        const [, ownerId, folderName] = match;
        console.log('\n🔓 Folder Info:');
        console.log('  Extracted Owner ID from S3 path:', ownerId);
        console.log('  Folder Name:', folderName);
        console.log('  Full Folder Prefix:', `outputs/${ownerId}/${folderName}/`);
        
        // Check if folder is shared
        const shares = await prisma.folderShare.findMany({
          where: {
            folderPrefix: `outputs/${ownerId}/${folderName}/`
          }
        });
        
        if (shares.length > 0) {
          console.log('\n👥 Folder Shares:');
          shares.forEach((share, idx) => {
            console.log(`  ${idx + 1}. Shared with: ${share.sharedWithClerkId}`);
            console.log(`     Permission: ${share.permission}`);
            console.log(`     Created: ${share.createdAt}`);
          });
        } else {
          console.log('\n👥 No folder shares found');
        }
      }
    }
    
    console.log('\n========================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestImage();
