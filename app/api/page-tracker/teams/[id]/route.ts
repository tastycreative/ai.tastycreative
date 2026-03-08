import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH /api/page-tracker/teams/[id] — update a team
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const orgId = user.currentOrganizationId;

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const existing = await prisma.trackerTeam.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, color, order } = body;

  const changes: string[] = [];
  if (name !== undefined && name.trim() !== existing.name) changes.push(`renamed to "${name.trim()}"`);
  if (color !== undefined && color !== existing.color) changes.push(`color changed`);
  if (order !== undefined && order !== existing.order) changes.push(`reordered`);

  const team = await prisma.trackerTeam.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    },
    include: {
      _count: { select: { entries: true } },
    },
  });

  if (changes.length > 0) {
    await prisma.trackerActivityLog.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        action: 'UPDATED',
        entityType: 'team',
        entityId: id,
        entityName: existing.name,
        details: `Updated team "${existing.name}": ${changes.join(', ')}`,
      },
    });
  }

  return NextResponse.json(team);
}

// DELETE /api/page-tracker/teams/[id] — delete a team (entries become unassigned)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const orgId = user.currentOrganizationId;

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const existing = await prisma.trackerTeam.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  await prisma.trackerTeam.delete({ where: { id } });

  await prisma.trackerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: 'DELETED',
      entityType: 'team',
      entityId: id,
      entityName: existing.name,
      details: `Deleted team "${existing.name}"`,
    },
  });

  return NextResponse.json({ success: true });
}
