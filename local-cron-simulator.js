// Local Cron Simulator - Runs every minute to check for due posts
// Keep this running in a terminal while testing locally

const CRON_SECRET = '8f4a2e1c9d3b7a5e6f8c2a1d4b9e7c3f5a8d2e6b9c4f7a1e3d8b5c2f6a9e4d7c';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function triggerCron() {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  console.log(`\n⏰ [${timestamp}] Checking for due posts...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/instagram/cron`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      }
    });

    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    
    if (data.reminders.total > 0) {
      console.log(`✅ Sent ${data.reminders.sent} notification(s)`);
      data.results.forEach(result => {
        console.log(`   📬 Post ${result.postId.slice(0, 8)}... - ${result.success ? 'Success' : 'Failed'}`);
      });
    } else {
      console.log(`✓ No due posts at this time`);
    }
  } catch (error) {
    console.error(`❌ Failed to trigger cron:`, error.message);
  }
}

console.log('🚀 Local Cron Simulator Started');
console.log(`📍 Monitoring: ${BASE_URL}/api/instagram/cron`);
console.log('⏱️  Running every 60 seconds...');
console.log('Press Ctrl+C to stop\n');

// Run immediately
triggerCron();

// Then run every minute
setInterval(triggerCron, 60000);
