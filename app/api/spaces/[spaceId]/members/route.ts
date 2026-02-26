import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId/members — fetch space members            */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spaceId } = await params;

    // Check if user has access to this space
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the space to check organization
    const space = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Check if user is a member of this space
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: user.id,
      },
    });

    // If not a space member, check if user is an organization owner/admin
    if (!membership) {
      const orgMembership = await prisma.teamMember.findFirst({
        where: {
          userId: user.id,
          organizationId: space.organizationId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!orgMembership) {
        return NextResponse.json(
          { error: 'You do not have access to this space' },
          { status: 403 }
        );
      }
    }

    // Fetch all members of the space
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: spaceId,
      },
      select: {
        id: true,
        userId: true,
        role: true,
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
    });

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: m.users,
      }))
    );
  } catch (error) {
    console.error('Error fetching space members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space members' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/members — add member to space           */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spaceId } = await params;

    // Check if current user has permission to add members (must be OWNER or ADMIN)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the space to check organization
    const space = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true },
    });

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Check if user is a space owner/admin
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    // If not a space owner/admin, check if user is an organization owner/admin
    if (!membership) {
      const orgMembership = await prisma.teamMember.findFirst({
        where: {
          userId: user.id,
          organizationId: space.organizationId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!orgMembership) {
        return NextResponse.json(
          { error: 'You do not have permission to add members to this space' },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.userId || !body.role) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and role' },
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

    // Check if user to be added exists
    const targetUser = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: spaceId,
        userId: body.userId,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this space' },
        { status: 400 }
      );
    }

    // Add the member
    const newMember = await prisma.workspaceMember.create({
      data: {
        workspaceId: spaceId,
        userId: body.userId,
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
    });

    return NextResponse.json({
      userId: newMember.userId,
      role: newMember.role,
      user: newMember.users,
    });
  } catch (error) {
    console.error('Error adding space member:', error);
    return NextResponse.json(
      { error: 'Failed to add member to space' },
      { status: 500 }
    );
  }
}
