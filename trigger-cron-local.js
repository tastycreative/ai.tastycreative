const { PrismaClient } = require('./lib/generated/prisma');
const { sendEmailReminder } = require('./lib/notification-service');

const prisma = new PrismaClient();

async function triggerCron() {
  try {
    const now = new Date();
    console.log('\n🕐 Current Time:', now.toISOString());
    console.log('🕐 Local Time:', now.toString());
    
    // Find scheduled posts that are due
    const scheduledPosts = await prisma.instagramPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: {
          lte: now
        }
      },
      include: {
        user: true
      }
    });

    console.log(`\n📬 Found ${scheduledPosts.length} post(s) ready to send\n`);

    const results = [];
    
    for (const post of scheduledPosts) {
      try {
        console.log(`📧 Sending email for post: ${post.fileName}`);
        console.log(`   Scheduled for: ${post.scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
        
        // Send email notification
        await sendEmailReminder(post);
        
        // Update status to PENDING
        await prisma.instagramPost.update({
          where: { id: post.id },
          data: { status: 'PENDING' }
        });
        
        console.log(`   ✅ Email sent successfully!`);
        
        results.push({
          postId: post.id,
          success: true
        });
      } catch (error) {
        console.error(`   ❌ Failed to send email:`, error.message);
        results.push({
          postId: post.id,
          success: false,
          error: error.message
        });
      }
    }

    console.log('\n✅ Cron job completed');
    console.log('Summary:', {
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      total: results.length
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

triggerCron();
