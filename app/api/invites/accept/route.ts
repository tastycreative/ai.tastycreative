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

    // Create membership, mark invite accepted, and auto-assign teams in an interactive transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create org membership
      const newMember = await tx.teamMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: dbUser!.id,
          role: invite.role,
        },
      });

      // 2. Mark invite as accepted
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      // 3. Set as current organization if user doesn't have one
      await tx.user.update({
        where: { id: dbUser!.id },
        data: {
          currentOrganizationId: dbUser!.currentOrganizationId || invite.organizationId,
        },
      });

      // 4. Auto-assign to teams if teamIds were specified on the invite
      const rawTeamIds = invite.teamIds as string[] | null;
      if (rawTeamIds && Array.isArray(rawTeamIds) && rawTeamIds.length > 0) {
        // Verify teams still exist in this org
        const validTeams = await tx.orgTeam.findMany({
          where: {
            id: { in: rawTeamIds },
            organizationId: invite.organizationId,
          },
          select: { id: true },
        });

        if (validTeams.length > 0) {
          await Promise.all(
            validTeams.map((team) =>
              tx.orgTeamMember.create({
                data: {
                  teamId: team.id,
                  teamMemberId: newMember.id,
                  assignedBy: invite.invitedBy,
                },
              })
            )
          );
        }
      }
    });

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
