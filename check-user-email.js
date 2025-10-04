const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkUserEmail() {
  try {
    // Get the scheduled post
    const post = await prisma.instagramPost.findFirst({
      where: {
        status: 'PENDING' // The post we just processed
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (!post) {
      console.log('No PENDING post found');
      return;
    }

    console.log('\n📧 User Email Information:');
    console.log('Post ID:', post.id);
    console.log('Post File:', post.fileName);
    console.log('Post Status:', post.status);
    console.log('\nUser Details:');
    console.log('User ID:', post.user.id);
    console.log('Clerk ID:', post.user.clerkId);
    console.log('Email:', post.user.email || '❌ NO EMAIL STORED');
    console.log('Name:', post.user.firstName, post.user.lastName);

    if (!post.user.email) {
      console.log('\n⚠️ WARNING: No email stored in database!');
      console.log('The cron job will try to fetch it from Clerk.');
      console.log('Check your Clerk dashboard for the user email.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserEmail();
