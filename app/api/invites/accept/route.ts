import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find the invite
    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found or invalid' },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: 'This invitation has already been used' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      );
    }

    // Get user's email from Clerk
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userEmail = user.emailAddresses[0]?.emailAddress;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Check if email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Get or create user in database
    let dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email: userEmail,
          name: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.username || userEmail,
        },
      });
    }

    // Check if already a member
    const existingMembership = await prisma.teamMember.findFirst({
      where: {
        organizationId: invite.organizationId,
        userId: dbUser.id,
      },
    });

    if (existingMembership) {
      // Mark invite as accepted even if already a member
      await prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        organizationSlug: invite.organization.slug,
        alreadyMember: true,
      });
    }

    // Create membership and mark invite as accepted in a transaction
    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: dbUser.id,
          role: invite.role,
        },
      }),
      prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      // Set as current organization if user doesn't have one
      prisma.user.update({
        where: { id: dbUser.id },
        data: {
          currentOrganizationId: dbUser.currentOrganizationId || invite.organizationId,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `You've successfully joined ${invite.organization.name}`,
      organizationSlug: invite.organization.slug,
      organizationName: invite.organization.name,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
