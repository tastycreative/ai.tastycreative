import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string }> };

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/members/bulk — add multiple members     */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;

    // Check if current user has permission to add members (must be OWNER or ADMIN)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not have permission to add members to this space' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.userIds) || !body.role) {
      return NextResponse.json(
        { error: 'Missing required fields: userIds (array) and role' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: OWNER, ADMIN, MEMBER, VIEWER' },
        { status: 400 }
      );
    }

    // Filter out users that are already members
    const existingMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: spaceId,
        userId: { in: body.userIds },
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existingMembers.map(m => m.userId));
    const userIdsToAdd = body.userIds.filter((id: string) => !existingUserIds.has(id));

    if (userIdsToAdd.length === 0) {
      return NextResponse.json(
        { error: 'All selected users are already members of this space' },
        { status: 400 }
      );
    }

    // Verify all users exist
    const users = await prisma.user.findMany({
      where: { id: { in: userIdsToAdd } },
      select: { id: true },
    });

    if (users.length !== userIdsToAdd.length) {
      return NextResponse.json(
        { error: 'One or more users not found' },
        { status: 404 }
      );
    }

    // Add all members in a transaction
    const newMembers = await prisma.$transaction(
      userIdsToAdd.map((userId: string) =>
        prisma.workspaceMember.create({
          data: {
            workspaceId: spaceId,
            userId: userId,
            role: body.role,
          },
          include: {
            users: {
              select: {
                id: true,
                clerkId: true,
                name: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      added: newMembers.length,
      members: newMembers.map(m => ({
        userId: m.userId,
        role: m.role,
        user: m.users,
      })),
    });
  } catch (error) {
    console.error('Error adding space members:', error);
    return NextResponse.json(
      { error: 'Failed to add members to space' },
      { status: 500 }
    );
  }
}
