const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function createTestNotifications() {
  try {
    // Get your user
    const user = await prisma.user.findUnique({
      where: {
        clerkId: 'user_30jxATDqYuUneSqppGUHNfIo9Qs'
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    // Get scheduled posts
    const scheduledPosts = await prisma.instagramPost.findMany({
      where: {
        status: 'SCHEDULED',
        clerkId: user.clerkId
      },
      take: 5
    });

    console.log(`Found ${scheduledPosts.length} scheduled posts`);

    // Create a notification for each
    for (const post of scheduledPosts) {
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'POST_REMINDER',
          title: '📸 Time to post on Instagram!',
          message: `Your scheduled post "${post.fileName}" is ready to share`,
          link: `/dashboard/social-media?post=${post.id}`,
          metadata: { 
            postId: post.id,
            fileName: post.fileName,
            imageUrl: post.driveFileUrl,
          },
          read: false,
        }
      });
      
      console.log(`✅ Created notification ${notification.id} for post ${post.fileName}`);
    }

    console.log('\n🎉 Test notifications created! Check your dashboard.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestNotifications();
