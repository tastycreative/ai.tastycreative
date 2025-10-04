// Test Resend API directly
const { Resend } = require('resend');
require('dotenv').config({ path: '.env.local' });

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
  console.log('🔑 API Key:', process.env.RESEND_API_KEY ? 'Configured ✅' : 'Missing ❌');
  
  try {
    console.log('\n📧 Sending test email to tasty4459@gmail.com (your Resend account email)...');
    
    const result = await resend.emails.send({
      from: 'TastyCreative <onboarding@resend.dev>',
      to: 'tasty4459@gmail.com',
      subject: 'Test Email from TastyCreative',
      html: '<h1>Test Email</h1><p>This is a test email to verify Resend is working.</p>',
    });

    console.log('✅ Email sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }
  }
}

testResend();
