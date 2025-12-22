const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function createFreshNotification() {
  try {
    const contentCreator = await prisma.user.findUnique({
      where: {
        clerkId: 'user_30jxATDqYuUneSqppGUHNfIo9Qs'
      }
    });

    if (!contentCreator) {
      console.log('❌ Content creator not found');
      return;
    }

    const notification = await prisma.notification.create({
      data: {
        userId: contentCreator.id,
        type: 'POST_REMINDER',
        title: '🧪 Test Notification',
        message: 'This is a test notification to verify the bell icon is working. Click to dismiss!',
        link: '/dashboard/social-media',
        read: false,
      }
    });

    console.log('✅ Created NEW UNREAD notification!');
    console.log('Notification ID:', notification.id);
    console.log('Title:', notification.title);
    console.log('\n🔔 Now check your content creator dashboard!');
    console.log('You should see a red badge on the bell icon.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createFreshNotification();
