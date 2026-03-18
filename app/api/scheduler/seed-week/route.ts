import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';
import { getSlotForDay } from '@/lib/scheduler/rotation';

// POST /api/scheduler/seed-week — auto-generate 7 task slots (one per day)
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

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { weekStart, tabId } = body;

  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart required' }, { status: 400 });
  }

  const weekStartDate = new Date(weekStart);

  // Check if tasks already exist for this week
  const existing = await prisma.schedulerTask.count({
    where: { organizationId: orgId, weekStartDate },
  });

  if (existing > 0) {
    return NextResponse.json({ error: 'Week already seeded', count: existing }, { status: 409 });
  }

  // Create 7 tasks — one per day: Mon=1A, Tue=1B, ..., Sun=1G
  const data = [];
  for (let day = 0; day < 7; day++) {
    data.push({
      organizationId: orgId,
      weekStartDate,
      dayOfWeek: day,
      slotLabel: getSlotForDay(day),
    });
  }

  const result = await prisma.schedulerTask.createMany({ data });

  await broadcastToScheduler(orgId, {
    type: 'tasks.seeded',
    weekStart,
    count: result.count,
    tabId: tabId || '__server__',
  });

  return NextResponse.json({ count: result.count }, { status: 201 });
}
