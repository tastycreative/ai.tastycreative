import { prisma } from '@/lib/database';
import { sendBatchEmail } from '@/lib/email';
import { publishNotificationToUser } from '@/lib/ably-server';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NotificationSettings {
  memberEnabled: boolean;
  memberMode: 'all' | 'column';
  notifyAssigned: boolean;
  notifyOnboarding?: boolean;
  columnMembers?: Record<string, string[]>;
}

interface BoardOnboardingNotificationParams {
  spaceId: string;
  boardId: string;
  itemId: string;
  itemTitle: string;
  itemNo: number;
  columnId: string;
  columnName: string;
}

/* ------------------------------------------------------------------ */
/*  Main function                                                      */
/* ------------------------------------------------------------------ */

export async function sendBoardOnboardingNotification(params: BoardOnboardingNotificationParams) {
  const {
    spaceId,
    itemId,
    itemTitle,
    itemNo,
    columnName,
  } = params;

  // Fetch workspace config for notification settings
  const workspace = await prisma.workspace.findUnique({
    where: { id: spaceId },
    select: {
      name: true,
      slug: true,
      key: true,
      config: true,
      organizationId: true,
      organization: { select: { slug: true } },
      members: {
        select: {
          userId: true,
          users: { select: { id: true, clerkId: true, email: true, name: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!workspace) return;

  const config = (workspace.config as Record<string, unknown>) ?? {};
  const notifications = (config.notifications as NotificationSettings | undefined) ?? {
    memberEnabled: false,
    memberMode: 'all',
    notifyAssigned: false,
    notifyOnboarding: false,
  };

  // Only proceed if onboarding notifications are enabled
  if (!notifications.notifyOnboarding) return;

  // Build recipient list — for onboarding, use the same member notification logic
  const recipientClerkIds = new Set<string>();

  if (notifications.memberEnabled) {
    if (notifications.memberMode === 'all') {
      for (const m of workspace.members) {
        recipientClerkIds.add(m.users.clerkId);
      }
    } else if (notifications.memberMode === 'column') {
      const colMembers = notifications.columnMembers ?? {};
      const assignedToColumn = colMembers[params.columnId] ?? [];
      for (const clerkId of assignedToColumn) {
        recipientClerkIds.add(clerkId);
      }
    }
  }

  // If member notifications are disabled but onboarding is enabled,
  // fall back to notifying all space members
  if (!notifications.memberEnabled) {
    for (const m of workspace.members) {
      recipientClerkIds.add(m.users.clerkId);
    }
  }

  if (recipientClerkIds.size === 0) return;

  // Resolve emails and user IDs for in-app notifications
  const recipientUsers = await prisma.user.findMany({
    where: { clerkId: { in: [...recipientClerkIds] } },
    select: { id: true, clerkId: true, email: true },
  });

  const emails = recipientUsers
    .map((u) => u.email)
    .filter((e): e is string => !!e);

  const spaceName = workspace.name;
  const displayTitle = `#${itemNo} ${itemTitle}`;

  // Build task card link
  const tenantSlug = workspace.organization?.slug;
  const spaceKey = workspace.key;
  const taskKey = spaceKey && itemNo ? `${spaceKey}-${itemNo}`.toLowerCase() : null;
  const taskLink = tenantSlug && taskKey
    ? `/${tenantSlug}/spaces/${workspace.slug}?task=${taskKey}`
    : null;

  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Build full URL for email
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const fullTaskLink = taskLink ? `${appUrl}${taskLink}` : null;

  // Send email
  if (emails.length > 0) {
    const html = buildOnboardingEmailTemplate({
      displayTitle,
      columnName,
      spaceName,
      timestamp,
      taskLink: fullTaskLink,
    });

    await sendBatchEmail({
      bcc: emails,
      subject: `[${spaceName}] New onboarding: ${displayTitle}`,
      html,
    });
  }

  // Create in-app notifications and push via Ably
  if (recipientUsers.length > 0) {
    const notifTitle = `New onboarding item created`;
    const notifMessage = `"${displayTitle}" was added to ${columnName} in ${spaceName} via webhook`;
    const now = new Date().toISOString();

    // Create DB records
    const created = await Promise.all(
      recipientUsers.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            organizationId: workspace.organizationId,
            type: 'BOARD_ONBOARDING',
            title: notifTitle,
            message: notifMessage,
            link: taskLink,
          },
        }),
      ),
    );

    // Push real-time Ably events to each recipient
    for (let i = 0; i < recipientUsers.length; i++) {
      publishNotificationToUser(recipientUsers[i].clerkId, {
        id: created[i].id,
        type: 'BOARD_ONBOARDING',
        title: notifTitle,
        message: notifMessage,
        link: taskLink,
        createdAt: now,
      }).catch(() => {}); // fire-and-forget
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Email template                                                     */
/* ------------------------------------------------------------------ */

function buildOnboardingEmailTemplate(params: {
  displayTitle: string;
  columnName: string;
  spaceName: string;
  timestamp: string;
  taskLink: string | null;
}): string {
  const { displayTitle, columnName, spaceName, timestamp, taskLink } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Onboarding Item</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #F774B9 0%, #5DC3F8 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">
                      New Onboarding Item
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      A new onboarding item has been created in <strong>${spaceName}</strong> via webhook.
                    </p>

                    <!-- Item card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f8f8; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 12px 0;">
                            ${displayTitle}
                          </p>
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #666; font-size: 13px; padding-right: 8px;">
                                Added to
                              </td>
                              <td style="background-color: #5DC3F8; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                                ${columnName}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #999999; font-size: 13px; margin: 0 0 24px 0;">
                      ${timestamp}
                    </p>

                    ${taskLink ? `
                    <!-- CTA Button -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${taskLink}" style="display: inline-block; background: linear-gradient(135deg, #F774B9 0%, #5DC3F8 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 15px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            View Item
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
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
