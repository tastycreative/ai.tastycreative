const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function resetPendingPosts() {
  try {
    // Reset PENDING posts back to SCHEDULED for testing
    const result = await prisma.instagramPost.updateMany({
      where: {
        status: 'PENDING'
      },
      data: {
        status: 'SCHEDULED'
      }
    });

    console.log(`✅ Reset ${result.count} PENDING post(s) back to SCHEDULED`);
    console.log('\nNow schedule a new post and test the email reminder!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPendingPosts();
