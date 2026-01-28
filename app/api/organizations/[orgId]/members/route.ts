import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { clerkClient } from '@clerk/nextjs/server';

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

    // Check if user has access to this organization
    const membership = await prisma.teamMember.findFirst({
      where: {
        organizationId: orgId,
        user: { clerkId: userId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all organization members from database
    const dbMembers = await prisma.teamMember.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        user: {
          include: {
            _count: {
              select: {
                images: true,
                videos: true,
                jobs: true,
                influencers: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get Clerk IDs to fetch from Clerk
    const clerkIds = dbMembers.map((m) => m.user.clerkId);

    // Fetch user details from Clerk for additional info
    const clerk = await clerkClient();
    const clerkUsersPromises = clerkIds.map((id) =>
      clerk.users.getUser(id).catch(() => null)
    );
    const clerkUsers = await Promise.all(clerkUsersPromises);

    // Merge the data
    const members = dbMembers.map((member) => {
      const clerkUser = clerkUsers.find((cu) => cu?.id === member.user.clerkId);

      return {
        id: member.id,
        userId: member.user.id,
        clerkId: member.user.clerkId,
        email: clerkUser?.emailAddresses[0]?.emailAddress || member.user.email,
        firstName: clerkUser?.firstName || member.user.firstName,
        lastName: clerkUser?.lastName || member.user.lastName,
        imageUrl: clerkUser?.imageUrl || member.user.imageUrl,
        role: member.role,
        joinedAt: member.createdAt.toISOString(),
        lastSignInAt: clerkUser?.lastSignInAt?.toString() || null,
        inClerk: !!clerkUser,
        _count: member.user._count,
      };
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a member from organization
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
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner of the organization
    const currentMembership = await prisma.teamMember.findFirst({
      where: {
        organizationId: orgId,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!currentMembership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the member to be removed
    const memberToRemove = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.organizationId !== orgId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing the owner
    if (memberToRemove.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot remove the organization owner' },
        { status: 400 }
      );
    }

    // Remove the member
    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true, message: 'Member removed' });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}

// PATCH - Update member role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await params;
    const { memberId, role } = await req.json();

    if (!memberId || !role) {
      return NextResponse.json(
        { error: 'Member ID and role are required' },
        { status: 400 }
      );
    }

    // Check if user is admin/owner of the organization
    const currentMembership = await prisma.teamMember.findFirst({
      where: {
        organizationId: orgId,
        user: { clerkId: userId },
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!currentMembership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the member to be updated
    const memberToUpdate = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.organizationId !== orgId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent changing the owner role
    if (memberToUpdate.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot change the role of the organization owner' },
        { status: 400 }
      );
    }

    // Update the role
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json({
      success: true,
      message: 'Member role updated',
      member: updatedMember,
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}
