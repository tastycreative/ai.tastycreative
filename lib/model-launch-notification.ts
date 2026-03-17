import { prisma } from '@/lib/database';
import { sendBatchEmail } from '@/lib/email';
import { publishNotificationToUser } from '@/lib/ably-server';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ModelLaunchNotificationParams {
  modelName: string;
  profileId: string;
  launchedByClerkId: string;
  organizationId: string;
}

/* ------------------------------------------------------------------ */
/*  Main function                                                      */
/* ------------------------------------------------------------------ */

export async function sendModelLaunchNotification(params: ModelLaunchNotificationParams) {
  const { modelName, profileId, launchedByClerkId, organizationId } = params;

  // Fetch org members
  const orgMembers = await prisma.teamMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, clerkId: true, email: true, name: true, firstName: true, lastName: true },
      },
    },
  });

  if (orgMembers.length === 0) return;

  // Resolve launcher display name
  const launcherUser = await prisma.user.findFirst({
    where: { clerkId: launchedByClerkId },
    select: { name: true, firstName: true, lastName: true, email: true },
  });
  const launcherName =
    launcherUser?.name ||
    [launcherUser?.firstName, launcherUser?.lastName].filter(Boolean).join(' ') ||
    launcherUser?.email ||
    'Someone';

  // Fetch org slug for building the profile URL
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  if (!org?.slug) return;

  // Exclude the launcher from recipients
  const recipients = orgMembers
    .filter((m) => m.user.clerkId !== launchedByClerkId)
    .map((m) => m.user);

  if (recipients.length === 0) return;

  // Build profile link
  const profileLink = `/${org.slug}/workspace/my-influencers/${profileId}`;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const fullProfileLink = `${appUrl}${profileLink}`;

  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Send batch email
  const emails = recipients
    .map((u) => u.email)
    .filter((e): e is string => !!e);

  if (emails.length > 0) {
    const html = buildLaunchEmailTemplate({
      modelName,
      launcherName,
      timestamp,
      profileLink: fullProfileLink,
    });

    await sendBatchEmail({
      bcc: emails,
      subject: `New Model Launched: ${modelName}`,
      html,
    }).catch((e) => console.error('[model-launch-notification] email failed:', e));
  }

  // Create in-app notifications and push via Ably
  const notifTitle = 'New Model Launched';
  const notifMessage = `${launcherName} launched a new model: ${modelName}`;
  const now = new Date().toISOString();

  const created = await Promise.all(
    recipients.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          organizationId,
          type: 'BOARD_ONBOARDING',
          title: notifTitle,
          message: notifMessage,
          link: profileLink,
        },
      }),
    ),
  );

  // Push real-time Ably events to each recipient
  for (let i = 0; i < recipients.length; i++) {
    publishNotificationToUser(recipients[i].clerkId, {
      id: created[i].id,
      type: 'BOARD_ONBOARDING',
      title: notifTitle,
      message: notifMessage,
      link: profileLink,
      createdAt: now,
    }).catch(() => {}); // fire-and-forget
  }
}

/* ------------------------------------------------------------------ */
/*  Email template                                                     */
/* ------------------------------------------------------------------ */

function buildLaunchEmailTemplate(params: {
  modelName: string;
  launcherName: string;
  timestamp: string;
  profileLink: string;
}): string {
  const { modelName, launcherName, timestamp, profileLink } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Model Launched</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #F774B9 0%, #E1518E 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">
                      New Model Launched
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong>${launcherName}</strong> has launched a new model.
                    </p>

                    <!-- Model card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f8f8; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">
                            ${modelName}
                          </p>
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background-color: #5DC3F8; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                                Launched
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #999999; font-size: 13px; margin: 0 0 24px 0;">
                      ${timestamp}
                    </p>

                    <!-- CTA Button -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${profileLink}" style="display: inline-block; background: linear-gradient(135deg, #F774B9 0%, #E1518E 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 15px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            View Profile
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                      &copy; ${new Date().getFullYear()} Tasty Creative. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
