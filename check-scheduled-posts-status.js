const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkScheduledPosts() {
  try {
    const now = new Date();
    
    console.log('\n🕐 Current Time:');
    console.log('UTC:', now.toISOString());
    console.log('Local:', now.toString());
    console.log('Philippine Time:', now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    
    // Get the post scheduled for 5:29 PM
    const posts = await prisma.instagramPost.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'PENDING']
        }
      },
      orderBy: {
        scheduledDate: 'asc'
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

    console.log(`\n📅 Found ${posts.length} scheduled/pending post(s):\n`);
    
    posts.forEach((post, index) => {
      const scheduled = new Date(post.scheduledDate);
      const isDue = scheduled <= now;
      const timeDiff = Math.round((scheduled - now) / 1000 / 60);
      
      console.log(`${index + 1}. ${post.fileName}`);
      console.log(`   Status: ${post.status}`);
      console.log(`   Scheduled (UTC): ${scheduled.toISOString()}`);
      console.log(`   Scheduled (Local): ${scheduled.toString()}`);
      console.log(`   Scheduled (PH): ${scheduled.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
      console.log(`   Is Due? ${isDue ? '✅ YES' : '❌ NO'}`);
      console.log(`   Time until due: ${timeDiff} minutes`);
      console.log(`   Last updated: ${post.updatedAt}`);
      console.log('');
    });

    // Check if there are notifications for "Time to post"
    const reminderNotifications = await prisma.notification.findMany({
      where: {
        type: 'POST_REMINDER',
        title: '📸 Time to post on Instagram!'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      select: {
        id: true,
        message: true,
        createdAt: true,
        read: true
      }
    });

    console.log(`\n📬 Recent "Time to post" notifications (${reminderNotifications.length}):\n`);
    reminderNotifications.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.message}`);
      console.log(`   Created: ${notif.createdAt.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
      console.log(`   Read: ${notif.read}`);
      console.log('');
    });

    if (posts.some(p => p.status === 'SCHEDULED' && new Date(p.scheduledDate) <= now)) {
      console.log('⚠️ There are DUE posts that should have triggered notifications!');
      console.log('💡 You need to trigger the cron job manually or wait for it to run.');
      console.log('\nTo trigger manually, run:');
      console.log('$headers = @{ "Authorization" = "Bearer 8f4a2e1c9d3b7a5e6f8c2a1d4b9e7c3f5a8d2e6b9c4f7a1e3d8b5c2f6a9e4d7c"; "ngrok-skip-browser-warning" = "true" }; Invoke-RestMethod -Uri "https://3b13f86dba03.ngrok-free.app/api/instagram/cron" -Headers $headers');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkScheduledPosts();
