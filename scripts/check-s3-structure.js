const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

async function checkS3Structure() {
  try {
    const post = await prisma.instagramPost.findFirst({
      where: { awsS3Url: { not: null } },
      select: { 
        awsS3Url: true, 
        awsS3Key: true, 
        status: true,
        clerkId: true,
        folder: true,
      }
    });

    if (post) {
      console.log('Sample post data:');
      console.log('Status:', post.status);
      console.log('Folder:', post.folder);
      console.log('ClerkId:', post.clerkId);
      console.log('S3 Key:', post.awsS3Key);
      console.log('S3 URL:', post.awsS3Url);
    } else {
      console.log('No posts found with S3 URLs');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkS3Structure();
