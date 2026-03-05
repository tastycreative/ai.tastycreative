import { prisma } from '@/lib/database';
import { sendBatchEmail } from '@/lib/email';

/* ------------------------------------------------------------------ */
/*  In-memory debounce: suppress duplicate notifications per item      */
/* ------------------------------------------------------------------ */

const DEBOUNCE_TTL_MS = 5_000;
const debounceCache = new Map<string, number>();

function isDebounced(itemId: string): boolean {
  const lastSent = debounceCache.get(itemId);
  if (lastSent && Date.now() - lastSent < DEBOUNCE_TTL_MS) return true;
  debounceCache.set(itemId, Date.now());
  return false;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NotificationSettings {
  memberEnabled: boolean;
  memberMode: 'all' | 'column';
  notifyAssigned: boolean;
  columnMembers?: Record<string, string[]>;
}

interface BoardMoveNotificationParams {
  boardId: string;
  itemId: string;
  itemTitle: string;
  itemNo: number | null;
  oldColumnId: string;
  oldColumnName: string;
  newColumnId: string;
  newColumnName: string;
  movedByUserId: string;
  assigneeId: string | null;
  createdBy: string | null;
  spaceId: string;
}

/* ------------------------------------------------------------------ */
/*  Main function                                                      */
/* ------------------------------------------------------------------ */

export async function sendBoardMoveNotification(params: BoardMoveNotificationParams) {
  const {
    itemId,
    itemTitle,
    itemNo,
    oldColumnId,
    oldColumnName,
    newColumnId,
    newColumnName,
    movedByUserId,
    assigneeId,
    createdBy,
    spaceId,
  } = params;

  // Skip same-column moves
  if (oldColumnId === newColumnId) return;

  // Debounce rapid moves on the same item
  if (isDebounced(itemId)) return;

  // Fetch workspace config for notification settings
  const workspace = await prisma.workspace.findUnique({
    where: { id: spaceId },
    select: {
      name: true,
      config: true,
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
  };

  const { memberEnabled, memberMode, notifyAssigned } = notifications;

  // Nothing enabled → skip
  if (!memberEnabled && !notifyAssigned) return;

  // Resolve the mover's display name
  const moverUser = await prisma.user.findFirst({
    where: { clerkId: movedByUserId },
    select: { name: true, firstName: true, lastName: true, email: true },
  });
  const moverName =
    moverUser?.name ||
    [moverUser?.firstName, moverUser?.lastName].filter(Boolean).join(' ') ||
    moverUser?.email ||
    'Someone';

  // Build recipient list
  const recipientClerkIds = new Set<string>();

  if (memberEnabled) {
    if (memberMode === 'all') {
      for (const m of workspace.members) {
        recipientClerkIds.add(m.users.clerkId);
      }
    } else if (memberMode === 'column') {
      const colMembers = notifications.columnMembers ?? {};
      const assignedToColumn = colMembers[newColumnId] ?? [];
      for (const clerkId of assignedToColumn) {
        recipientClerkIds.add(clerkId);
      }
    }
  }

  if (notifyAssigned) {
    if (assigneeId) recipientClerkIds.add(assigneeId);
    if (createdBy) recipientClerkIds.add(createdBy);
  }

  // Exclude the mover
  recipientClerkIds.delete(movedByUserId);

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
  const displayTitle = itemNo ? `#${itemNo} ${itemTitle}` : itemTitle;
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Send email
  if (emails.length > 0) {
    const html = buildEmailTemplate({
      displayTitle,
      oldColumnName,
      newColumnName,
      spaceName,
      moverName,
      timestamp,
    });

    await sendBatchEmail({
      bcc: emails,
      subject: `[${spaceName}] ${displayTitle} moved to ${newColumnName}`,
      html,
    });
  }

  // Create in-app notifications
  if (recipientUsers.length > 0) {
    await prisma.notification.createMany({
      data: recipientUsers.map((u) => ({
        userId: u.id,
        type: 'BOARD_MOVE' as const,
        title: `Item moved to ${newColumnName}`,
        message: `${moverName} moved "${displayTitle}" from ${oldColumnName} to ${newColumnName} in ${spaceName}`,
      })),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Email template                                                     */
/* ------------------------------------------------------------------ */

function buildEmailTemplate(params: {
  displayTitle: string;
  oldColumnName: string;
  newColumnName: string;
  spaceName: string;
  moverName: string;
  timestamp: string;
}): string {
  const { displayTitle, oldColumnName, newColumnName, spaceName, moverName, timestamp } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Board Item Moved</title>
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
                      Board Item Moved
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong>${moverName}</strong> moved an item in <strong>${spaceName}</strong>.
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
                              <td style="background-color: #E1518E; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                                ${oldColumnName}
                              </td>
                              <td style="padding: 0 10px; color: #999; font-size: 18px;">
                                &rarr;
                              </td>
                              <td style="background-color: #5DC3F8; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
                                ${newColumnName}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #999999; font-size: 13px; margin: 0;">
                      ${timestamp}
                    </p>
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
