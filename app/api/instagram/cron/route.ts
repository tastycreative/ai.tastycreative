import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { sendAllNotifications } from '@/lib/notification-service';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Cron job to send reminders for scheduled Instagram posts
 * GET /api/instagram/cron
 * 
 * This sends email + browser notifications to remind users to post manually
 * Works with personal Instagram accounts (no API required)
 * 
 * Add to vercel.json: 
 * {
 *   "crons": [{
 *     "path": "/api/instagram/cron",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is coming from Vercel Cron or has the correct secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`⏰ Running Instagram notification cron at ${now.toISOString()}`);

    // Find all posts that are scheduled and due for reminder
    const scheduledPosts = await prisma.instagramPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: {
          lte: now, // Less than or equal to current time
        },
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            email: true,
          },
        },
      },
    });

    console.log(`📋 Found ${scheduledPosts.length} posts to send reminders for`);

    const results = [];

    for (const post of scheduledPosts) {
      try {
        // Get user email from Clerk
        const clerk = await clerkClient();
        let userEmail = post.user.email;
        let userName = undefined;

        if (!userEmail) {
          try {
            const clerkUser = await clerk.users.getUser(post.user.clerkId);
            userEmail = clerkUser.emailAddresses[0]?.emailAddress || 'No email';
            userName = clerkUser.firstName || clerkUser.username || undefined;
          } catch (error) {
            console.error(`⚠️ Could not fetch email for user ${post.user.clerkId}`);
            userEmail = 'No email';
          }
        }

        if (userEmail === 'No email') {
          console.log(`⚠️ Skipping post ${post.id}: User has no email`);
          results.push({
            postId: post.id,
            success: false,
            error: 'No user email found',
          });
          continue;
        }

        // Send all notifications (email + browser + in-app)
        const notificationResult = await sendAllNotifications(
          {
            postId: post.id,
            caption: post.caption || '',
            imageUrl: post.driveFileUrl,
            fileName: post.fileName,
            scheduledDate: post.scheduledDate!,
            userEmail,
            userName,
          },
          post.user.id, // Use user database ID for notifications
          {
            sendEmail: false,  // Disable email
            sendBrowser: true, // Enable browser notifications
            sendInApp: true,   // Enable in-app notifications
          }
        );

        // Update post status to PENDING (waiting for user to post manually)
        await prisma.instagramPost.update({
          where: { id: post.id },
          data: {
            status: 'PENDING', // New status: reminder sent, waiting for user action
            updatedAt: new Date(),
          },
        });

        console.log(`✅ Sent reminder for post ${post.id} to ${userEmail}`);
        results.push({
          postId: post.id,
          success: true,
          notificationsSent: {
            email: notificationResult.email?.success || false,
            browser: !!notificationResult.browser,
            inApp: notificationResult.inApp?.success || false,
          },
        });
      } catch (error) {
        console.error(`❌ Error sending reminder for post ${post.id}:`, error);
        results.push({
          postId: post.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      reminders: {
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total: scheduledPosts.length,
      },
      results,
    });

  } catch (error) {
    console.error('❌ Error in Instagram notification cron:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Notification cron failed',
      },
      { status: 500 }
    );
  }
}
