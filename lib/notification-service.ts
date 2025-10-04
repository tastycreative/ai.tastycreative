/**
 * Notification Service for Instagram Post Reminders
 * Supports Email, Browser Push Notifications, and In-App Notifications
 */

import { Resend } from 'resend';
import { prisma } from './database';

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null;

function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface PostReminderData {
  postId: string;
  caption: string;
  imageUrl: string;
  fileName: string;
  scheduledDate: Date;
  userEmail: string;
  userName?: string;
}

/**
 * Send email reminder to user to post on Instagram
 */
export async function sendEmailReminder(data: PostReminderData) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('⚠️ Resend client could not be initialized');
      return { success: false, error: 'Email service not initialized' };
    }

    const emailHtml = generateReminderEmail(data);
    
    const result = await resendClient.emails.send({
      from: 'TastyCreative <onboarding@resend.dev>',
      to: data.userEmail,
      subject: `📸 Time to post on Instagram!`,
      html: emailHtml,
    });

    console.log(`✅ Email sent to ${data.userEmail} for post ${data.postId}`);
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}

/**
 * Generate HTML email template for post reminder
 */
function generateReminderEmail(data: PostReminderData): string {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const viewPostUrl = `${appUrl}/dashboard/social-media?post=${data.postId}`;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Time to Post on Instagram</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📸 Time to Post!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your scheduled Instagram post is ready</p>
        </div>
        
        <!-- Content -->
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          
          <!-- Image Preview -->
          <div style="text-align: center; margin-bottom: 25px;">
            <img src="${data.imageUrl}" alt="Post preview" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          </div>
          
          <!-- Caption -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">📝 Your Caption:</h3>
            <p style="white-space: pre-wrap; color: #555; margin: 0;">${data.caption || 'No caption'}</p>
          </div>
          
          <!-- Instructions -->
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #856404;">🎯 How to Post:</h3>
            <ol style="margin: 10px 0; padding-left: 20px; color: #856404;">
              <li>Open Instagram app on your phone</li>
              <li>Click the <strong>+</strong> button</li>
              <li>Download the image by clicking the button below</li>
              <li>Upload the image to Instagram</li>
              <li>Copy and paste the caption above</li>
              <li>Click <strong>Share</strong>!</li>
            </ol>
          </div>
          
          <!-- Action Buttons -->
          <div style="text-align: center; margin: 25px 0;">
            <a href="${data.imageUrl}" download="${data.fileName}" style="display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 5px;">
              ⬇️ Download Image
            </a>
            <a href="${viewPostUrl}" style="display: inline-block; background: #764ba2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 5px;">
              👁️ View in App
            </a>
          </div>
          
          <!-- Quick Copy Section -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
              <strong>💡 Pro Tip:</strong> Click "View in App" to easily copy your caption!
            </p>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding: 20px; color: #999; font-size: 12px;">
          <p>Scheduled for: <strong>${new Date(data.scheduledDate).toLocaleString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit' 
          })}</strong></p>
          <p style="margin-top: 15px;">
            Made with ❤️ by <a href="${appUrl}" style="color: #667eea; text-decoration: none;">TastyCreative</a>
          </p>
          <p style="margin-top: 10px; font-size: 11px; color: #bbb;">
            This is an automated reminder for your scheduled Instagram post.
          </p>
        </div>
        
      </body>
    </html>
  `;
}

/**
 * Send browser push notification (requires user permission)
 */
export async function sendBrowserNotification(data: PostReminderData) {
  // This is called from the client-side in the browser
  // Server just prepares the data
  return {
    title: '📸 Time to post on Instagram!',
    body: `"${data.caption?.slice(0, 50) || data.fileName}"...`,
    icon: data.imageUrl,
    badge: '/instagram-icon.png',
    data: {
      url: `/dashboard/social-media?post=${data.postId}`,
      postId: data.postId,
    },
  };
}

/**
 * Create in-app notification record
 */
export async function createInAppNotification(data: PostReminderData, userId: string) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'POST_REMINDER',
        title: '📸 Time to post on Instagram!',
        message: `Your scheduled post "${data.fileName}" is ready to share`,
        link: `/dashboard/social-media?post=${data.postId}`,
        metadata: { 
          postId: data.postId,
          fileName: data.fileName,
          imageUrl: data.imageUrl,
          caption: data.caption.slice(0, 100),
        },
        read: false,
      }
    });
    
    console.log(`📬 In-app notification created for user ${userId} - notification ${notification.id}`);
    return { success: true, notificationId: notification.id };
  } catch (error) {
    console.error('❌ Failed to create in-app notification:', error);
    return { success: false, error };
  }
}

/**
 * Send all notifications (email + browser + in-app)
 */
export async function sendAllNotifications(
  postData: PostReminderData,
  userId: string,
  options: {
    sendEmail?: boolean;
    sendBrowser?: boolean;
    sendInApp?: boolean;
  } = { sendEmail: true, sendBrowser: true, sendInApp: true }
) {
  const results = {
    email: null as any,
    browser: null as any,
    inApp: null as any,
  };

  if (options.sendEmail) {
    results.email = await sendEmailReminder(postData);
  }

  if (options.sendBrowser) {
    results.browser = await sendBrowserNotification(postData);
  }

  if (options.sendInApp) {
    results.inApp = await createInAppNotification(postData, userId);
  }

  return results;
}
