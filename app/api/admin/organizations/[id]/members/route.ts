import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;
    const body = await req.json();
    const { userId: newUserId, role, canInviteMembers, canManageBilling, canManageMembers } = body;

    if (!newUserId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user exists
    const newUser = await prisma.user.findUnique({
      where: { id: newUserId },
    });

    if (!newUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if member already exists
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_organizationId: {
          userId: newUserId,
          organizationId: organizationId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    // Create team member
    const teamMember = await prisma.teamMember.create({
      data: {
        userId: newUserId,
        organizationId: organizationId,
        role: role,
        canInviteMembers: canInviteMembers ?? false,
        canManageBilling: canManageBilling ?? false,
        canManageMembers: canManageMembers ?? false,
        invitedBy: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      member: teamMember,
    });
  } catch (error) {
    console.error('Error adding member to organization:', error);
    return NextResponse.json(
      { error: 'Failed to add member to organization' },
      { status: 500 }
    );
  }
}
