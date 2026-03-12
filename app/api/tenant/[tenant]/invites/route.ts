import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { sendOrganizationInvite } from '@/lib/email';
import { publishNotificationToUser } from '@/lib/ably-server';
import crypto from 'crypto';

// Force Node.js runtime for nodemailer support
export const runtime = 'nodejs';

// GET - List all invites for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant } = await params;

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin/owner of the organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch pending invites
    const invites = await prisma.organizationInvite.findMany({
      where: {
        organizationId: organization.id,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}

// POST - Send invitations (supports bulk)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant } = await params;
    const { emails, role = 'MEMBER' } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Emails array is required' },
        { status: 400 }
      );
    }

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin/owner of the organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const inviterName = `${membership.user.firstName || ''} ${membership.user.lastName || ''}`.trim() || 'Someone';

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter((email: string) => emailRegex.test(email));

    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: 'No valid email addresses provided' },
        { status: 400 }
      );
    }

    const invited: Array<{ email: string }> = [];
    const failed: Array<{ email: string; error: string }> = [];
    const skipped: string[] = [];

    // Check for existing members
    const existingMembers = await prisma.teamMember.findMany({
      where: {
        organizationId: organization.id,
        user: {
          email: { in: validEmails },
        },
      },
      include: { user: true },
    });

    const existingEmails = new Set(existingMembers.map((m: any) => m.user.email?.toLowerCase()));

    // Filter out existing members
    const newEmails = validEmails.filter((email: string) => {
      if (existingEmails.has(email.toLowerCase())) {
        skipped.push(email);
        return false;
      }
      return true;
    });

    // Create invites and send emails
    for (const email of newEmails) {
      try {
        // Check for any existing invite (pending, expired, or accepted)
        const existingInvite = await prisma.organizationInvite.findFirst({
          where: {
            organizationId: organization.id,
            email: email.toLowerCase(),
          },
        });

        // If there's a valid pending invite, skip re-sending
        if (existingInvite && existingInvite.acceptedAt === null && existingInvite.expiresAt > new Date()) {
          skipped.push(email);
          continue;
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Update existing record or create new one
        const invite = existingInvite
          ? await prisma.organizationInvite.update({
              where: { id: existingInvite.id },
              data: {
                role,
                invitedBy: membership.userId,
                token,
                expiresAt,
                acceptedAt: null,
              },
            })
          : await prisma.organizationInvite.create({
              data: {
                organizationId: organization.id,
                email: email.toLowerCase(),
                role,
                invitedBy: membership.userId,
                token,
                expiresAt,
              },
            });

        // Send email - use current request host for invite URL
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host') || 'localhost:3000';
        const inviteUrl = `${protocol}://${host}/invite/${invite.token}`;
        await sendOrganizationInvite({
          to: email,
          organizationName: organization.name,
          inviterName,
          inviteUrl,
        });

        invited.push({ email });

        // Create in-app notification if the invited email belongs to an existing user
        try {
          const invitedUser = await prisma.user.findFirst({
            where: { email: email.toLowerCase() },
            select: { id: true, clerkId: true },
          });

          if (invitedUser) {
            // Check if notification already exists for this invite
            const existingNotification = await prisma.notification.findFirst({
              where: {
                userId: invitedUser.id,
                type: 'ORG_INVITATION',
                metadata: { path: ['inviteId'], equals: invite.id },
              },
            });

            if (existingNotification) {
              // Re-send: update the link with the new token
              await prisma.notification.update({
                where: { id: existingNotification.id },
                data: { link: `/invite/${invite.token}`, read: false, readAt: null },
              });
            } else {
              const notification = await prisma.notification.create({
                data: {
                  userId: invitedUser.id,
                  type: 'ORG_INVITATION',
                  title: `You've been invited to ${organization.name}`,
                  message: `${inviterName} invited you to join ${organization.name} as a ${role}`,
                  link: `/invite/${invite.token}`,
                  metadata: { inviteId: invite.id },
                  organizationId: null,
                },
              });

              // Push real-time notification via Ably
              await publishNotificationToUser(invitedUser.clerkId, {
                id: notification.id,
                type: 'ORG_INVITATION',
                title: notification.title,
                message: notification.message,
                link: notification.link,
                createdAt: notification.createdAt.toISOString(),
              });
            }
          }
        } catch (notifError) {
          // Non-fatal: notification failure shouldn't break the invite flow
          console.error(`Failed to create notification for ${email}:`, notifError);
        }
      } catch (error) {
        console.error(`Failed to invite ${email}:`, error);
        failed.push({
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      invited,
      failed,
      skipped,
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel an invitation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant } = await params;
    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get('inviteId');

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Invite ID is required' },
        { status: 400 }
      );
    }

    // Get organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: tenant },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin/owner of the organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: organization.id,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the invite
    const invite = await prisma.organizationInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Delete the invite
    await prisma.organizationInvite.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({ success: true, message: 'Invite cancelled' });
  } catch (error) {
    console.error('Error cancelling invite:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invite' },
      { status: 500 }
    );
  }
}
