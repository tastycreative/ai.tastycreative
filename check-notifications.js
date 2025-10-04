const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkNotifications() {
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

    console.log('\n👤 Content Creator:');
    console.log('User ID:', contentCreator.id);
    console.log('Clerk ID:', contentCreator.clerkId);
    console.log('Email:', contentCreator.email);

    // Get all notifications for this user
    const notifications = await prisma.notification.findMany({
      where: {
        userId: contentCreator.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`\n🔔 Found ${notifications.length} notification(s):`);
    
    notifications.forEach((notif, index) => {
      console.log(`\n--- Notification ${index + 1} ---`);
      console.log('ID:', notif.id);
      console.log('Type:', notif.type);
      console.log('Title:', notif.title);
      console.log('Message:', notif.message);
      console.log('Read:', notif.read);
      console.log('Created:', notif.createdAt);
    });

    if (notifications.length === 0) {
      console.log('\n⚠️ No notifications found! The notification system might not have triggered.');
      
      // Check recent post updates
      console.log('\n📝 Checking recent post updates...');
      const recentPosts = await prisma.instagramPost.findMany({
        where: {
          clerkId: contentCreator.clerkId
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 5,
        select: {
          id: true,
          fileName: true,
          status: true,
          scheduledDate: true,
          updatedAt: true
        }
      });

      console.log(`\nRecent posts (last 5):`);
      recentPosts.forEach((post, index) => {
        console.log(`\n${index + 1}. ${post.fileName}`);
        console.log('   Status:', post.status);
        console.log('   Scheduled:', post.scheduledDate);
        console.log('   Updated:', post.updatedAt);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();
