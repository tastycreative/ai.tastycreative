import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';
import { generateSlotLabel } from '@/lib/scheduler/rotation';

// GET /api/scheduler?weekStart=2024-01-01
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

  const orgId = user.currentOrganizationId;

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const weekStart = request.nextUrl.searchParams.get('weekStart');
  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart param required' }, { status: 400 });
  }

  const profileId = request.nextUrl.searchParams.get('profileId');
  const platform = request.nextUrl.searchParams.get('platform');

  const tasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(weekStart),
      ...(profileId && { profileId }),
      ...(platform && { platform }),
    },
    orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }, { slotLabel: 'asc' }],
  });

  return NextResponse.json({ tasks });
}

// POST /api/scheduler — create a single task for a day
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, currentOrganizationId: true, name: true },
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
  const { weekStart, dayOfWeek, taskType, taskName, fields, platform, profileId, tabId } = body;

  if (!weekStart || dayOfWeek === undefined || dayOfWeek === null) {
    return NextResponse.json({ error: 'weekStart and dayOfWeek required' }, { status: 400 });
  }

  // Get max sortOrder for this day
  const maxTask = await prisma.schedulerTask.findFirst({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(weekStart),
      dayOfWeek: Number(dayOfWeek),
    },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const nextSortOrder = (maxTask?.sortOrder ?? -1) + 1;
  const slotLabel = generateSlotLabel(Number(dayOfWeek));

  const task = await prisma.schedulerTask.create({
    data: {
      organizationId: orgId,
      weekStartDate: new Date(weekStart),
      dayOfWeek: Number(dayOfWeek),
      slotLabel,
      sortOrder: nextSortOrder,
      taskType: taskType || '',
      taskName: taskName || '',
      fields: fields || null,
      platform: platform || 'free',
      profileId: profileId || null,
      updatedBy: user.name || userId,
    },
  });

  await prisma.trackerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: 'CREATED',
      entityType: 'pod-task',
      entityId: task.id,
      entityName: task.slotLabel,
      details: `Created ${task.taskType || 'task'} on day ${task.dayOfWeek}`,
    },
  });

  await broadcastToScheduler(orgId, {
    type: 'task.created',
    taskId: task.id,
    dayOfWeek: task.dayOfWeek,
    slotLabel: task.slotLabel,
    tabId: tabId || '__server__',
  });

  return NextResponse.json(task, { status: 201 });
}
