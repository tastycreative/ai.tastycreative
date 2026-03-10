import { prisma } from '@/lib/database';
import { sendEmail } from '@/lib/email';
import { publishNotificationToUser } from '@/lib/ably-server';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BoardAssignNotificationParams {
  itemId: string;
  itemTitle: string;
  itemNo: number | null;
  assigneeClerkId: string;
  assignedByUserId: string;
  spaceId: string;
}

/* ------------------------------------------------------------------ */
/*  Main function                                                      */
/* ------------------------------------------------------------------ */

export async function sendBoardAssignNotification(params: BoardAssignNotificationParams) {
  const {
    itemId,
    itemTitle,
    itemNo,
    assigneeClerkId,
    assignedByUserId,
    spaceId,
  } = params;

  // Don't notify if user assigned themselves
  if (assigneeClerkId === assignedByUserId) return;

  // Fetch workspace info
  const workspace = await prisma.workspace.findUnique({
    where: { id: spaceId },
    select: {
      name: true,
      slug: true,
      key: true,
      organizationId: true,
      organization: { select: { slug: true } },
    },
  });

  if (!workspace) return;

  // Resolve assigner display name
  const assignerUser = await prisma.user.findFirst({
    where: { clerkId: assignedByUserId },
    select: { name: true, firstName: true, lastName: true, email: true },
  });
  const assignerName =
    assignerUser?.name ||
    [assignerUser?.firstName, assignerUser?.lastName].filter(Boolean).join(' ') ||
    assignerUser?.email ||
    'Someone';

  // Resolve assignee user
  const assigneeUser = await prisma.user.findFirst({
    where: { clerkId: assigneeClerkId },
    select: { id: true, clerkId: true, email: true, name: true, firstName: true },
  });

  if (!assigneeUser) return;

  const spaceName = workspace.name;
  const displayTitle = itemNo ? `#${itemNo} ${itemTitle}` : itemTitle;
  const assigneeName = assigneeUser.name || assigneeUser.firstName || 'there';

  // Build task link
  const tenantSlug = workspace.organization?.slug;
  const spaceKey = workspace.key;
  const taskKey = spaceKey && itemNo ? `${spaceKey}-${itemNo}`.toLowerCase() : null;
  const taskLink = tenantSlug && taskKey
    ? `/${tenantSlug}/spaces/${workspace.slug}?task=${taskKey}`
    : null;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const fullTaskLink = taskLink ? `${appUrl}${taskLink}` : null;

  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Send email
  if (assigneeUser.email) {
    const html = buildAssignEmailTemplate({
      displayTitle,
      spaceName,
      assignerName,
      assigneeName,
      timestamp,
      taskLink: fullTaskLink,
    });

    await sendEmail({
      to: assigneeUser.email,
      subject: `[${spaceName}] You've been assigned to ${displayTitle}`,
      html,
    }).catch((e) => console.error('[board-assign-notification] email failed:', e));
  }

  // Create in-app notification + Ably push
  const notifTitle = 'Task assigned to you';
  const notifMessage = `${assignerName} assigned you to "${displayTitle}" in ${spaceName}`;

  const created = await prisma.notification.create({
    data: {
      userId: assigneeUser.id,
      organizationId: workspace.organizationId,
      type: 'BOARD_ASSIGN',
      title: notifTitle,
      message: notifMessage,
      link: taskLink,
    },
  });

  publishNotificationToUser(assigneeUser.clerkId, {
    id: created.id,
    type: 'BOARD_ASSIGN',
    title: notifTitle,
    message: notifMessage,
    link: taskLink,
    createdAt: new Date().toISOString(),
  }).catch(() => {}); // fire-and-forget
}

/* ------------------------------------------------------------------ */
/*  Email template                                                     */
/* ------------------------------------------------------------------ */

function buildAssignEmailTemplate(params: {
  displayTitle: string;
  spaceName: string;
  assignerName: string;
  assigneeName: string;
  timestamp: string;
  taskLink: string | null;
}): string {
  const { displayTitle, spaceName, assignerName, assigneeName, timestamp, taskLink } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Assigned</title>
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
                      Task Assigned to You
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hi <strong>${assigneeName}</strong>,
                    </p>
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong>${assignerName}</strong> assigned you to a task in <strong>${spaceName}</strong>.
                    </p>

                    <!-- Item card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f8f8; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">
                            ${displayTitle}
                          </p>
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background-color: #F774B9; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                                Assigned to you
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
                          <a href="${taskLink}" style="display: inline-block; background: linear-gradient(135deg, #F774B9 0%, #E1518E 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 15px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            View Task
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
