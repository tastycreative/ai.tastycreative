import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/page-tracker/teams — list teams for the org
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const teams = await prisma.trackerTeam.findMany({
    where: { organizationId: user.currentOrganizationId },
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json(teams);
}

// POST /api/page-tracker/teams — create a team
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const orgId = user.currentOrganizationId;

  // Verify admin/manager role
  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { name, color } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
  }

  // Get max order for new team
  const maxOrder = await prisma.trackerTeam.aggregate({
    where: { organizationId: orgId },
    _max: { order: true },
  });

  const team = await prisma.trackerTeam.create({
    data: {
      name: name.trim(),
      color: color || null,
      order: (maxOrder._max.order ?? -1) + 1,
      organizationId: orgId,
    },
    include: {
      _count: { select: { entries: true } },
    },
  });

  await prisma.trackerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: 'CREATED',
      entityType: 'team',
      entityId: team.id,
      entityName: team.name,
      details: `Created team "${team.name}"`,
    },
  });

  return NextResponse.json(team, { status: 201 });
}
