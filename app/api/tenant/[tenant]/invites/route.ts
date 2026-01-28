import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { sendOrganizationInvite } from '@/lib/email';
import crypto from 'crypto';

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
    const membership = await prisma.organizationMember.findFirst({
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
    const membership = await prisma.organizationMember.findFirst({
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
    const existingMembers = await prisma.organizationMember.findMany({
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
        // Check for existing pending invite
        const existingInvite = await prisma.organizationInvite.findFirst({
          where: {
            organizationId: organization.id,
            email: email.toLowerCase(),
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvite) {
          skipped.push(email);
          continue;
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');

        // Create invite
        const invite = await prisma.organizationInvite.create({
          data: {
            organizationId: organization.id,
            email: email.toLowerCase(),
            role,
            invitedBy: membership.userId,
            token,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
    const membership = await prisma.organizationMember.findFirst({
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
