const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function testAdminScheduleNotification() {
  try {
    // Get content creator user
    const contentCreator = await prisma.user.findUnique({
      where: {
        clerkId: 'user_30jxATDqYuUneSqppGUHNfIo9Qs'
      }
    });

    if (!contentCreator) {
      console.log('❌ Content creator not found');
      return;
    }

    // Get one of their posts
    const post = await prisma.instagramPost.findFirst({
      where: {
        clerkId: contentCreator.clerkId,
        status: 'SCHEDULED'
      }
    });

    if (!post) {
      console.log('❌ No scheduled posts found');
      return;
    }

    console.log(`\n📝 Post: ${post.fileName}`);
    console.log(`Status: ${post.status}`);
    console.log(`Scheduled: ${post.scheduledDate}`);

    // Simulate admin scheduling the post - create notification
    const notification = await prisma.notification.create({
      data: {
        userId: contentCreator.id,
        type: 'POST_REMINDER',
        title: '📅 Post Scheduled by Admin!',
        message: `Your post "${post.fileName}" has been scheduled for ${post.scheduledDate ? new Date(post.scheduledDate).toLocaleString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit' 
        }) : 'soon'}`,
        link: `/dashboard/social-media?post=${post.id}`,
        metadata: { 
          postId: post.id,
          fileName: post.fileName,
          imageUrl: post.driveFileUrl,
          status: 'SCHEDULED',
        },
        read: false,
      }
    });

    console.log(`\n✅ Created notification: ${notification.id}`);
    console.log(`Title: ${notification.title}`);
    console.log(`Message: ${notification.message}`);
    console.log(`\n🎉 Check your dashboard! The notification bell should show a new notification.`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminScheduleNotification();
