import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string }> };

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/transfer-ownership                      */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || !body.newOwnerId) {
      return NextResponse.json({ error: 'New owner ID is required' }, { status: 400 });
    }

    const { newOwnerId } = body;

    // Get the current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if the current user is the OWNER of this space
    const currentOwnerMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: currentUser.id,
        role: 'OWNER',
      },
    });

    if (!currentOwnerMembership) {
      return NextResponse.json(
        { error: 'Only the current owner can transfer ownership' },
        { status: 403 }
      );
    }

    // Get workspace info to check organization
    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Check if the new owner is a member of the space or org owner/admin
    let newOwnerMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: newOwnerId,
      },
    });

    // If not a space member, check if they're an org owner/admin
    if (!newOwnerMembership) {
      const orgMembership = await prisma.teamMember.findFirst({
        where: {
          organizationId: workspace.organizationId,
          userId: newOwnerId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!orgMembership) {
        return NextResponse.json(
          { error: 'The new owner must be a space member or organization owner/admin' },
          { status: 400 }
        );
      }

      // If they're an org owner/admin but not a space member, add them to the space first
      newOwnerMembership = await prisma.workspaceMember.create({
        data: {
          workspaceId: spaceId,
          userId: newOwnerId,
          role: 'MEMBER', // Will be upgraded to OWNER immediately
        },
      });
    }

    // Perform the transfer in a transaction
    await prisma.$transaction(async (tx) => {
      // Downgrade current owner to ADMIN
      await tx.workspaceMember.update({
        where: { id: currentOwnerMembership.id },
        data: { role: 'ADMIN' },
      });

      // Upgrade new owner to OWNER
      await tx.workspaceMember.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'OWNER' },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Ownership transferred successfully',
    });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    return NextResponse.json(
      { error: 'Failed to transfer ownership' },
      { status: 500 }
    );
  }
}
