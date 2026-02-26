import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string; memberId: string }> };

/* ------------------------------------------------------------------ */
/*  PATCH /api/spaces/:spaceId/members/:memberId — update role         */
/* ------------------------------------------------------------------ */

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId, memberId } = await params;

    // Check caller is OWNER or ADMIN
    const caller = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!caller) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const callerMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: spaceId, userId: caller.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!callerMembership) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    const validRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: body.role },
      include: {
        users: {
          select: { id: true, clerkId: true, name: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      userId: updated.userId,
      role: updated.role,
      user: updated.users,
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/spaces/:spaceId/members/:memberId — remove member      */
/* ------------------------------------------------------------------ */

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId, memberId } = await params;

    // Check caller is OWNER or ADMIN
    const caller = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!caller) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const callerMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: spaceId, userId: caller.id, role: { in: ['OWNER', 'ADMIN'] } },
    });
    if (!callerMembership) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prevent removing the last OWNER
    const target = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    if (target.role === 'OWNER') {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: spaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 });
      }
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
