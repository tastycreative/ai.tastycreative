import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { requireSuperAdminAccess } from '@/lib/adminAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check super admin access
    await requireSuperAdminAccess();

    // Get current user for invitedBy field
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
      select: { id: true }
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
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
        invitedBy: adminUser.id,
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
