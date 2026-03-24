import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishNotificationToUser } from '@/lib/ably-server';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { userId: callerClerkId } = await auth();
    if (!callerClerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      itemId,
      itemTitle,
      itemNo,
      assigneeClerkIds,
      spaceId,
      taskType,
      quantity,
      clientName,
      deadline,
    } = body as {
      itemId: string;
      itemTitle: string;
      itemNo: number | null;
      assigneeClerkIds: string[];
      spaceId: string;
      taskType: string;
      quantity: number;
      clientName: string;
      deadline: string;
    };

    if (!assigneeClerkIds?.length) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Fetch workspace for link building
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

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Resolve caller display name
    const callerUser = await prisma.user.findFirst({
      where: { clerkId: callerClerkId },
      select: { name: true, firstName: true, lastName: true, email: true },
    });
    const callerName =
      callerUser?.name ||
      [callerUser?.firstName, callerUser?.lastName].filter(Boolean).join(' ') ||
      callerUser?.email ||
      'Someone';

    // Resolve assignee users
    const assignees = await prisma.user.findMany({
      where: { clerkId: { in: assigneeClerkIds } },
      select: { id: true, clerkId: true, email: true, name: true, firstName: true },
    });

    const displayTitle = itemNo ? `#${itemNo} ${itemTitle}` : itemTitle;
    const spaceName = workspace.name;
    const tenantSlug = workspace.organization?.slug;
    const spaceKey = workspace.key;
    const taskKey =
      spaceKey && itemNo ? `${spaceKey}-${itemNo}`.toLowerCase() : null;
    const taskLink =
      tenantSlug && taskKey
        ? `/${tenantSlug}/spaces/${workspace.slug}?task=${taskKey}`
        : null;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000');
    const fullTaskLink = taskLink ? `${appUrl}${taskLink}` : null;

    const humanType = taskType?.replace(/_/g, ' ') ?? 'Content';
    const deadlineStr = deadline
      ? new Date(deadline).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null;

    let sent = 0;

    for (const assignee of assignees) {
      // Skip if assigning yourself
      if (assignee.clerkId === callerClerkId) continue;

      const notifTitle = 'Content generation task assigned';
      const notifMessage = `${callerName} assigned you a ${humanType} task "${displayTitle}" for ${clientName || 'a client'}${deadlineStr ? ` — due ${deadlineStr}` : ''} (qty ${quantity})`;

      const created = await prisma.notification.create({
        data: {
          userId: assignee.id,
          organizationId: workspace.organizationId,
          type: 'BOARD_ASSIGN',
          title: notifTitle,
          message: notifMessage,
          link: taskLink,
          metadata: { taskType, quantity, clientName, itemId },
        },
      });

      // Real-time push via Ably
      publishNotificationToUser(assignee.clerkId, {
        id: created.id,
        type: 'BOARD_ASSIGN',
        title: notifTitle,
        message: notifMessage,
        link: taskLink,
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      // Email
      if (assignee.email) {
        const assigneeName = assignee.name || assignee.firstName || 'there';
        sendEmail({
          to: assignee.email,
          subject: `[${spaceName}] You've been assigned: ${displayTitle}`,
          html: buildCGAssignEmail({
            displayTitle,
            spaceName,
            callerName,
            assigneeName,
            humanType,
            quantity,
            clientName,
            deadlineStr,
            taskLink: fullTaskLink,
          }),
        }).catch((e) =>
          console.error('[cg-notify] email failed:', e)
        );
      }

      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error('[cg-notify] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Email template                                                     */
/* ------------------------------------------------------------------ */

function buildCGAssignEmail(params: {
  displayTitle: string;
  spaceName: string;
  callerName: string;
  assigneeName: string;
  humanType: string;
  quantity: number;
  clientName: string;
  deadlineStr: string | null;
  taskLink: string | null;
}): string {
  const {
    displayTitle,
    spaceName,
    callerName,
    assigneeName,
    humanType,
    quantity,
    clientName,
    deadlineStr,
    taskLink,
  } = params;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Content Generation Task Assigned</title>
      </head>
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;padding:20px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#F774B9 0%,#E1518E 100%);padding:40px 20px;text-align:center;">
                    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">
                      Content Generation Task
                    </h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 30px;">
                    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">
                      Hi <strong>${assigneeName}</strong>,
                    </p>
                    <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">
                      <strong>${callerName}</strong> assigned you a content generation task in <strong>${spaceName}</strong>.
                    </p>
                    <table border="0" cellpadding="8" cellspacing="0" style="background:#f9f9f9;border-radius:6px;width:100%;margin-bottom:20px;">
                      <tr><td style="color:#666;width:120px;">Task</td><td style="color:#333;font-weight:bold;">${displayTitle}</td></tr>
                      <tr><td style="color:#666;">Type</td><td style="color:#333;">${humanType}</td></tr>
                      <tr><td style="color:#666;">Client</td><td style="color:#333;">${clientName || '—'}</td></tr>
                      <tr><td style="color:#666;">Quantity</td><td style="color:#333;">${quantity}</td></tr>
                      ${deadlineStr ? `<tr><td style="color:#666;">Deadline</td><td style="color:#333;">${deadlineStr}</td></tr>` : ''}
                    </table>
                    ${
                      taskLink
                        ? `<p style="text-align:center;"><a href="${taskLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#F774B9 0%,#E1518E 100%);color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">View Task</a></p>`
                        : ''
                    }
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f8f8f8;padding:20px 30px;text-align:center;">
                    <p style="color:#999;font-size:12px;margin:0;">Tasty Creative &mdash; Content Generation</p>
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
