import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';

// GET /api/scheduler/config
export async function GET() {
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

  const config = await prisma.schedulerConfig.findUnique({
    where: { organizationId: user.currentOrganizationId },
  });

  return NextResponse.json({ config });
}

// PUT /api/scheduler/config
export async function PUT(request: NextRequest) {
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

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { teamNames, rotationOffset, tabId } = body;

  const config = await prisma.schedulerConfig.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      teamNames: teamNames || [],
      rotationOffset: rotationOffset ?? 0,
    },
    update: {
      ...(teamNames !== undefined && { teamNames }),
      ...(rotationOffset !== undefined && { rotationOffset }),
    },
  });

  await broadcastToScheduler(orgId, {
    type: 'config.updated',
    tabId: tabId || '__server__',
  });

  return NextResponse.json({ config });
}
