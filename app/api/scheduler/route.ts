import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';
import { generateSlotLabel } from '@/lib/scheduler/rotation';
import crypto from 'crypto';

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

  // Resolve clerkId-based updatedBy values to real names
  const clerkIds = [...new Set(
    tasks.map((t) => t.updatedBy).filter((v): v is string => !!v && v.startsWith('user_')),
  )];
  if (clerkIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { clerkId: { in: clerkIds } },
      select: { clerkId: true, name: true, firstName: true, lastName: true },
    });
    const nameMap = new Map(
      users.map((u) => [
        u.clerkId,
        (u.name && !u.name.startsWith('user_') ? u.name : null) || [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
      ]),
    );
    // Collect unresolved clerkIds (DB had no name)
    const unresolvedIds: string[] = [];
    for (const t of tasks) {
      if (t.updatedBy && t.updatedBy.startsWith('user_')) {
        const resolved = nameMap.get(t.updatedBy);
        if (resolved) {
          (t as Record<string, unknown>).updatedBy = resolved;
        } else {
          unresolvedIds.push(t.updatedBy);
        }
      }
    }
    // Fallback: resolve remaining from Clerk API
    if (unresolvedIds.length > 0) {
      try {
        const clerk = await clerkClient();
        const uniqueUnresolved = [...new Set(unresolvedIds)];
        const clerkNameMap = new Map<string, string>();
        for (const cid of uniqueUnresolved) {
          try {
            const cu = await clerk.users.getUser(cid);
            const name = [cu.firstName, cu.lastName].filter(Boolean).join(' ');
            if (name) clerkNameMap.set(cid, name);
          } catch {}
        }
        for (const t of tasks) {
          if (t.updatedBy && t.updatedBy.startsWith('user_')) {
            const name = clerkNameMap.get(t.updatedBy);
            if (name) (t as Record<string, unknown>).updatedBy = name;
          }
        }
      } catch {}
    }
  }

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
    select: { id: true, currentOrganizationId: true, name: true, firstName: true, lastName: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const orgId = user.currentOrganizationId;

  // Resolve display name — DB first, then Clerk fallback
  const rawName = user.name && !user.name.startsWith('user_') ? user.name : null;
  let displayName = rawName || [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
  if (!displayName) {
    const clerkUser = await currentUser();
    displayName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || userId;
  }

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { weekStart, dayOfWeek, taskType, taskName, fields, platform, profileId, tabId, lineageId, sourceTaskId } = body;

  if (!weekStart || dayOfWeek === undefined || dayOfWeek === null) {
    return NextResponse.json({ error: 'weekStart and dayOfWeek required' }, { status: 400 });
  }

  // If sourceTaskId provided, copy fields from source task
  let resolvedFields = fields || null;
  let resolvedTaskType = taskType || '';
  let resolvedTaskName = taskName || '';
  let resolvedLineageId = lineageId || null;
  let resolvedPlatform = platform || 'free';
  let resolvedProfileId = profileId || null;

  if (sourceTaskId) {
    const sourceTask = await prisma.schedulerTask.findUnique({
      where: { id: sourceTaskId },
    });
    if (sourceTask) {
      resolvedFields = fields || sourceTask.fields;
      resolvedTaskType = taskType || sourceTask.taskType;
      resolvedTaskName = taskName || sourceTask.taskName;
      resolvedLineageId = sourceTask.lineageId || resolvedLineageId;
      resolvedPlatform = platform || sourceTask.platform;
      resolvedProfileId = profileId !== undefined ? profileId : sourceTask.profileId;
    }
  }

  // Auto-generate lineageId if not provided
  if (!resolvedLineageId) {
    resolvedLineageId = crypto.randomUUID();
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
      taskType: resolvedTaskType,
      taskName: resolvedTaskName,
      fields: resolvedFields,
      platform: resolvedPlatform,
      profileId: resolvedProfileId,
      lineageId: resolvedLineageId,
      sourceTaskId: sourceTaskId || null,
      updatedBy: displayName,
    },
  });

  const isQueued = !!sourceTaskId;
  const weekDate = new Date(weekStart + 'T00:00:00Z');
  const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[Number(dayOfWeek)] || `day ${dayOfWeek}`;

  const actionLabel = isQueued ? 'QUEUED' : 'CREATED';
  const summaryText = isQueued
    ? `Queued ${task.taskType || 'task'} for ${dayName}, week of ${weekLabel}`
    : `Created ${task.taskType || 'task'} on ${dayName}, week of ${weekLabel}`;

  const activityLog = await prisma.schedulerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      taskId: task.id,
      action: actionLabel,
      summary: summaryText,
    },
  });

  await prisma.schedulerTaskHistory.create({
    data: {
      taskId: task.id,
      userId: user.id,
      action: actionLabel,
      field: 'task',
      oldValue: isQueued ? sourceTaskId : null,
      newValue: summaryText,
      activityLogId: activityLog.id,
    },
  });

  // Also log on the source task's history when queuing
  if (isQueued) {
    await prisma.schedulerTaskHistory.create({
      data: {
        taskId: sourceTaskId,
        userId: user.id,
        action: 'QUEUED',
        field: 'task',
        oldValue: null,
        newValue: `Queued update for ${dayName}, week of ${weekLabel}`,
        activityLogId: activityLog.id,
      },
    });
  }

  await broadcastToScheduler(orgId, {
    type: 'task.created',
    taskId: task.id,
    dayOfWeek: task.dayOfWeek,
    slotLabel: task.slotLabel,
    tabId: tabId || '__server__',
  });

  return NextResponse.json(task, { status: 201 });
}
