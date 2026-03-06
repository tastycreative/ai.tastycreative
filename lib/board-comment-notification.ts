import { prisma } from '@/lib/database';
import { sendBatchEmail } from '@/lib/email';
import { publishNotificationToUser } from '@/lib/ably-server';
import { extractMentionedClerkIds, stripMentionMarkup } from '@/lib/mention-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BoardCommentNotificationParams {
  itemId: string;
  spaceId: string;
  commentContent: string;
  commenterClerkId: string;
}

/* ------------------------------------------------------------------ */
/*  Main function                                                      */
/* ------------------------------------------------------------------ */

export async function sendBoardCommentNotification(params: BoardCommentNotificationParams) {
  const { itemId, spaceId, commentContent, commenterClerkId } = params;

  // Fetch the board item with related data
  const item = await prisma.boardItem.findUnique({
    where: { id: itemId },
    select: {
      title: true,
      itemNo: true,
      assigneeId: true,
      createdBy: true,
      organizationId: true,
      comments: {
        select: { createdBy: true },
        distinct: ['createdBy'],
      },
    },
  });

  if (!item) return;

  // Fetch workspace for space name, slug, key, org slug
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

  // Build recipient list: assignee + creator + previous commenters + @mentions
  const recipientClerkIds = new Set<string>();

  if (item.assigneeId) recipientClerkIds.add(item.assigneeId);
  if (item.createdBy) recipientClerkIds.add(item.createdBy);
  for (const c of item.comments) {
    recipientClerkIds.add(c.createdBy);
  }
  for (const mentionedId of extractMentionedClerkIds(commentContent)) {
    recipientClerkIds.add(mentionedId);
  }

  // Exclude the commenter
  recipientClerkIds.delete(commenterClerkId);

  if (recipientClerkIds.size === 0) return;

  // Resolve commenter display name
  const commenterUser = await prisma.user.findFirst({
    where: { clerkId: commenterClerkId },
    select: { name: true, firstName: true, lastName: true, email: true },
  });
  const commenterName =
    commenterUser?.name ||
    [commenterUser?.firstName, commenterUser?.lastName].filter(Boolean).join(' ') ||
    commenterUser?.email ||
    'Someone';

  // Resolve recipient user records
  const recipientUsers = await prisma.user.findMany({
    where: { clerkId: { in: [...recipientClerkIds] } },
    select: { id: true, clerkId: true, email: true },
  });

  const emails = recipientUsers
    .map((u) => u.email)
    .filter((e): e is string => !!e);

  const displayTitle = item.itemNo ? `#${item.itemNo} ${item.title}` : item.title;

  // Build task card link
  const tenantSlug = workspace.organization?.slug;
  const spaceKey = workspace.key;
  const taskKey = spaceKey && item.itemNo ? `${spaceKey}-${item.itemNo}`.toLowerCase() : null;
  const taskLink = tenantSlug && taskKey
    ? `/${tenantSlug}/spaces/${workspace.slug}?task=${taskKey}`
    : null;

  // Strip mention markup and truncate for notification message
  const plainComment = stripMentionMarkup(commentContent);
  const truncatedComment = plainComment.length > 120
    ? plainComment.slice(0, 120) + '...'
    : plainComment;

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
    const html = buildCommentEmailTemplate({
      displayTitle,
      spaceName: workspace.name,
      commenterName,
      commentContent: truncatedComment,
      timestamp,
      taskLink: fullTaskLink,
    });

    await sendBatchEmail({
      bcc: emails,
      subject: `[${workspace.name}] ${commenterName} commented on ${displayTitle}`,
      html,
    });
  }

  // Create in-app notifications and push via Ably
  if (recipientUsers.length > 0) {
    const notifTitle = `New comment on ${displayTitle}`;
    const notifMessage = `${commenterName}: "${truncatedComment}"`;
    const now = new Date().toISOString();

    const created = await Promise.all(
      recipientUsers.map((u) =>
        prisma.notification.create({
          data: {
            userId: u.id,
            organizationId: workspace.organizationId,
            type: 'BOARD_COMMENT',
            title: notifTitle,
            message: notifMessage,
            link: taskLink,
          },
        }),
      ),
    );

    for (let i = 0; i < recipientUsers.length; i++) {
      publishNotificationToUser(recipientUsers[i].clerkId, {
        id: created[i].id,
        type: 'BOARD_COMMENT',
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

function buildCommentEmailTemplate(params: {
  displayTitle: string;
  spaceName: string;
  commenterName: string;
  commentContent: string;
  timestamp: string;
  taskLink: string | null;
}): string {
  const { displayTitle, spaceName, commenterName, commentContent, timestamp, taskLink } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Comment</title>
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
                      New Comment
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong>${commenterName}</strong> commented on an item in <strong>${spaceName}</strong>.
                    </p>

                    <!-- Item card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f8f8; border-radius: 8px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0 0 12px 0;">
                            ${displayTitle}
                          </p>
                          <div style="border-left: 3px solid #5DC3F8; padding-left: 12px; margin: 0;">
                            <p style="color: #555; font-size: 14px; line-height: 1.5; margin: 0; font-style: italic;">
                              "${commentContent}"
                            </p>
                          </div>
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
