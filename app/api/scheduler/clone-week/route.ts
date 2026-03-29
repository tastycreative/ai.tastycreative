import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';
import { generateSlotLabel } from '@/lib/scheduler/rotation';
import crypto from 'crypto';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * POST /api/scheduler/clone-week
 *
 * Server-side batch clone: copies tasks from one week to the next,
 * skipping tasks whose lineageId already exists in the target week.
 * Uses createMany per-day for speed (handles 200+ tasks in seconds).
 * Broadcasts real-time progress via Ably so all connected users see it.
 */
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

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const {
    sourceWeekStart,
    targetWeekStart,
    profileId,
    platform,
    days,
  } = body as {
    sourceWeekStart: string;
    targetWeekStart: string;
    profileId?: string | null;
    platform?: string;
    days?: number[]; // specific days, or omit/empty for all 7
  };

  if (!sourceWeekStart || !targetWeekStart) {
    return NextResponse.json(
      { error: 'sourceWeekStart and targetWeekStart required' },
      { status: 400 },
    );
  }

  const rawName = user.name && !user.name.startsWith('user_') ? user.name : null;
  let userName = rawName || [user.firstName, user.lastName].filter(Boolean).join(' ') || '';
  // Fallback: fetch name from Clerk if DB has no name
  if (!userName) {
    const clerkUser = await currentUser();
    userName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || userId;
  }
  const cloneDays = days && days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6];
  const isWholeWeek = cloneDays.length === 7;

  // Fetch source week tasks
  const sourceTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(sourceWeekStart),
      dayOfWeek: { in: cloneDays },
      ...(profileId && { profileId }),
      ...(platform && { platform }),
    },
    orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
  });

  // Fetch target week tasks to check for existing lineageIds
  const targetTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(targetWeekStart),
      dayOfWeek: { in: cloneDays },
      ...(profileId && { profileId }),
      ...(platform && { platform }),
    },
    select: { dayOfWeek: true, lineageId: true, sortOrder: true },
  });

  // Build existing lineageId sets per day
  const existingByDay = new Map<number, Set<string>>();
  for (const t of targetTasks) {
    if (!t.lineageId) continue;
    if (!existingByDay.has(t.dayOfWeek)) existingByDay.set(t.dayOfWeek, new Set());
    existingByDay.get(t.dayOfWeek)!.add(t.lineageId);
  }

  // Get max sortOrder per day in target week
  const maxSortByDay = new Map<number, number>();
  for (const t of targetTasks) {
    const cur = maxSortByDay.get(t.dayOfWeek) ?? -1;
    if (t.sortOrder > cur) maxSortByDay.set(t.dayOfWeek, t.sortOrder);
  }

  // Group source tasks by day, splitting into clone vs skip
  const toCloneByDay = new Map<number, typeof sourceTasks>();
  let totalSkipped = 0;
  let totalToClone = 0;

  for (const task of sourceTasks) {
    if (task.lineageId && existingByDay.get(task.dayOfWeek)?.has(task.lineageId)) {
      totalSkipped++;
      continue;
    }
    if (!toCloneByDay.has(task.dayOfWeek)) toCloneByDay.set(task.dayOfWeek, []);
    toCloneByDay.get(task.dayOfWeek)!.push(task);
    totalToClone++;
  }

  if (totalToClone === 0) {
    await broadcastToScheduler(orgId, {
      type: 'clone.complete',
      created: 0,
      skipped: totalSkipped,
      failed: 0,
      userName,
      isWholeWeek,
      days: cloneDays,
    });
    return NextResponse.json({ created: 0, skipped: totalSkipped, failed: 0 });
  }

  // Broadcast start
  await broadcastToScheduler(orgId, {
    type: 'clone.start',
    total: totalToClone,
    skipped: totalSkipped,
    userName,
    isWholeWeek,
    days: cloneDays,
  });

  let totalCreated = 0;
  let totalFailed = 0;
  let daysProcessed = 0;
  const totalDays = toCloneByDay.size;

  // Process each day as a batch
  for (const [day, dayTasks] of toCloneByDay) {
    let baseSortOrder = (maxSortByDay.get(day) ?? -1) + 1;

    // Build batch data for createMany
    const batchData = dayTasks.map((source) => {
      const sortOrder = baseSortOrder++;
      // Strip finalAmount from cloned fields — it's week-specific revenue data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let clonedFields: any = source.fields ?? undefined;
      if (clonedFields && typeof clonedFields === 'object' && !Array.isArray(clonedFields)) {
        const { finalAmount: _, ...rest } = clonedFields;
        if (_ !== undefined) {
          clonedFields = Object.keys(rest).length > 0 ? rest : undefined;
        }
      }
      return {
        organizationId: orgId,
        weekStartDate: new Date(targetWeekStart),
        dayOfWeek: day,
        slotLabel: generateSlotLabel(day),
        sortOrder,
        taskType: source.taskType,
        taskName: source.taskName,
        fields: clonedFields,
        platform: source.platform,
        profileId: source.profileId,
        lineageId: source.lineageId || crypto.randomUUID(),
        sourceTaskId: source.id,
        updatedBy: userName,
      };
    });

    try {
      const result = await prisma.schedulerTask.createMany({ data: batchData });
      totalCreated += result.count;
    } catch (err) {
      console.error(`[clone-week] Batch insert failed for day ${day}:`, err);
      totalFailed += dayTasks.length;
    }

    daysProcessed++;

    // Broadcast progress per day — keeps Ably calls minimal
    const taskTypes = [...new Set(dayTasks.map((t) => t.taskType))].join(', ');
    await broadcastToScheduler(orgId, {
      type: 'clone.progress',
      currentDay: daysProcessed,
      totalDays,
      tasksInDay: dayTasks.length,
      totalCloned: totalCreated,
      totalToClone,
      totalFailed,
      skipped: totalSkipped,
      day,
      dayName: DAY_NAMES[day] || '',
      taskTypes,
      userName,
    });
  }

  // Unflag source tasks that were flagged — the flag has been carried to the clone
  if (totalCreated > 0) {
    const flaggedSourceIds: string[] = [];
    for (const [, dayTasks] of toCloneByDay) {
      for (const task of dayTasks) {
        const fields = task.fields as Record<string, unknown> | null;
        if (fields && (fields.flagged === 'true' || fields.flagged === true)) {
          flaggedSourceIds.push(task.id);
        }
      }
    }
    if (flaggedSourceIds.length > 0) {
      // Remove flagged from each source task's fields JSON
      await Promise.all(
        flaggedSourceIds.map(async (id) => {
          const t = sourceTasks.find((s) => s.id === id);
          if (!t) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fields = { ...(t.fields as any || {}) };
          delete fields.flagged;
          await prisma.schedulerTask.update({
            where: { id },
            data: { fields: Object.keys(fields).length > 0 ? fields : undefined },
          });
        }),
      );
    }
  }

  // Broadcast completion
  await broadcastToScheduler(orgId, {
    type: 'clone.complete',
    created: totalCreated,
    skipped: totalSkipped,
    failed: totalFailed,
    userName,
    isWholeWeek,
    days: cloneDays,
  });

  // Broadcast task refresh so all users' grids update
  await broadcastToScheduler(orgId, {
    type: 'tasks.seeded',
    tabId: '__server__',
  });

  // Activity log
  const label = isWholeWeek ? 'whole week' : cloneDays.map((d) => DAY_NAMES[d]).join(', ');
  await prisma.schedulerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      taskId: null,
      action: 'CLONED',
      summary: `Cloned ${totalCreated} task(s) (${label}) from week ${sourceWeekStart} to ${targetWeekStart}${totalSkipped > 0 ? ` (${totalSkipped} skipped)` : ''}`,
    },
  });

  return NextResponse.json({ created: totalCreated, skipped: totalSkipped, failed: totalFailed });
}
