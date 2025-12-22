const { PrismaClient } = require('./lib/generated/prisma');

const prisma = new PrismaClient();

async function checkScheduledPosts() {
  try {
    const posts = await prisma.instagramPost.findMany({
      where: {
        status: 'SCHEDULED'
      },
      select: {
        id: true,
        fileName: true,
        scheduledDate: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    });

    const now = new Date();
    console.log('\n🕐 Current Time:');
    console.log('UTC:', now.toISOString());
    console.log('Local:', now.toString());
    console.log('Local formatted:', now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    
    console.log('\n📅 Scheduled Posts:');
    posts.forEach(post => {
      const scheduled = new Date(post.scheduledDate);
      const isDue = scheduled <= now;
      
      console.log('\n---');
      console.log('Post ID:', post.id);
      console.log('File:', post.fileName);
      console.log('Scheduled (UTC):', scheduled.toISOString());
      console.log('Scheduled (Local):', scheduled.toString());
      console.log('Scheduled (PH):', scheduled.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      console.log('Is Due?', isDue ? '✅ YES' : '❌ NO');
      console.log('Time diff:', Math.round((scheduled - now) / 1000 / 60), 'minutes');
    });

    if (posts.length === 0) {
      console.log('No scheduled posts found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkScheduledPosts();
