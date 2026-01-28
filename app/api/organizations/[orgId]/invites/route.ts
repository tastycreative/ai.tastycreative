import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { sendOrganizationInvite } from '@/lib/email';
import crypto from 'crypto';

// GET - List all invites for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;

    // Check if user is admin/owner of the organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: orgId,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all pending invites
    const invites = await prisma.organizationInvite.findMany({
      where: {
        organizationId: orgId,
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
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const { emails, role = 'MEMBER' } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Emails array is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: 'Invalid email addresses', invalidEmails },
        { status: 400 }
      );
    }

    // Check if user is admin/owner of the organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: orgId,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        user: true,
        organization: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if any emails are already members
    const existingMembers = await prisma.teamMember.findMany({
      where: {
        organizationId: orgId,
        user: {
          email: { in: emails },
        },
      },
      include: { user: true },
    });

    const existingMemberEmails = existingMembers.map((m) => m.user.email);
    const newEmails = emails.filter((email) => !existingMemberEmails.includes(email));

    if (newEmails.length === 0) {
      return NextResponse.json(
        { error: 'All emails are already members', existingMemberEmails },
        { status: 400 }
      );
    }

    // Create invitations
    const inviteResults = [];
    const failedInvites = [];

    for (const email of newEmails) {
      try {
        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Check if invite already exists
        const existingInvite = await prisma.organizationInvite.findFirst({
          where: {
            organizationId: orgId,
            email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

        let invite;

        if (existingInvite) {
          // Update existing invite with new token and expiry
          invite = await prisma.organizationInvite.update({
            where: { id: existingInvite.id },
            data: {
              token,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
              role,
            },
          });
        } else {
          // Create new invite
          invite = await prisma.organizationInvite.create({
            data: {
              organizationId: orgId,
              email,
              role,
              invitedBy: userId,
              token,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });
        }

        // Send email - use current request host for invite URL
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host') || 'localhost:3000';
        const inviteUrl = `${protocol}://${host}/invite/${invite.token}`;

        const emailResult = await sendOrganizationInvite({
          to: email,
          organizationName: membership.organization.name,
          inviterName: membership.user.name || membership.user.email || 'Someone',
          inviteUrl,
        });

        if (emailResult.success) {
          inviteResults.push({ email, status: 'sent', inviteId: invite.id });
        } else {
          failedInvites.push({ email, error: 'Failed to send email' });
        }
      } catch (error) {
        console.error(`Error creating invite for ${email}:`, error);
        failedInvites.push({ email, error: 'Failed to create invite' });
      }
    }

    return NextResponse.json({
      success: true,
      invited: inviteResults,
      failed: failedInvites,
      skipped: existingMemberEmails,
      message: `Successfully sent ${inviteResults.length} invitation(s)`,
    });
  } catch (error) {
    console.error('Error sending invites:', error);
    return NextResponse.json(
      { error: 'Failed to send invites' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel an invitation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get('inviteId');

    if (!inviteId) {
      return NextResponse.json(
        { error: 'Invite ID is required' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner of the organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: orgId,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the invite
    await prisma.organizationInvite.delete({
      where: {
        id: inviteId,
        organizationId: orgId,
      },
    });

    return NextResponse.json({ success: true, message: 'Invite cancelled' });
  } catch (error) {
    console.error('Error deleting invite:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invite' },
      { status: 500 }
    );
  }
}
