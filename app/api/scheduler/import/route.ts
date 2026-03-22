import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';
import { generateSlotLabel } from '@/lib/scheduler/rotation';

interface ImportTask {
  dayOfWeek: number;
  taskType: string;
  taskName: string;
  fields: Record<string, string>;
  sortOrder: number;
}

type ImportMode = 'replace' | 'append' | 'replace_by_type';

/**
 * POST /api/scheduler/import
 * Bulk-saves confirmed tasks from the import preview.
 *
 * Body: {
 *   weekStart: string,
 *   platform: string,
 *   profileId: string | null,
 *   mode: 'replace' | 'append' | 'replace_by_type',
 *   tasks: ImportTask[]
 * }
 */
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
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: orgId,
      },
    },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { weekStart, platform, profileId, tasks, mode = 'append' } = body as {
    weekStart: string;
    platform: string;
    profileId: string | null;
    tasks: ImportTask[];
    mode?: ImportMode;
  };

  if (!weekStart || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'weekStart and non-empty tasks array required' }, { status: 400 });
  }

  const weekStartDate = new Date(weekStart);

  const baseWhere = {
    organizationId: orgId,
    weekStartDate,
    ...(profileId ? { profileId } : {}),
    ...(platform ? { platform } : {}),
  };

  let deleted = 0;

  // ── Handle deletion based on mode ──
  if (mode === 'replace') {
    // Delete ALL existing tasks for this week/platform/profile
    const result = await prisma.schedulerTask.deleteMany({ where: baseWhere });
    deleted = result.count;
  } else if (mode === 'replace_by_type') {
    // Delete only tasks whose type appears in the import
    const importedTypes = [...new Set(tasks.map((t) => t.taskType))];
    const result = await prisma.schedulerTask.deleteMany({
      where: { ...baseWhere, taskType: { in: importedTypes } },
    });
    deleted = result.count;
  }
  // mode === 'append' → no deletion

  // ── Calculate sortOrder offsets ──
  const existingMaxes = await prisma.schedulerTask.groupBy({
    by: ['dayOfWeek'],
    where: baseWhere,
    _max: { sortOrder: true },
  });

  const maxByDay: Record<number, number> = {};
  for (const row of existingMaxes) {
    maxByDay[row.dayOfWeek] = (row._max.sortOrder ?? -1) + 1;
  }

  // ── Build insert data ──
  const data = tasks.map((task) => {
    const baseSort = maxByDay[task.dayOfWeek] ?? 0;
    const sortOrder = baseSort + task.sortOrder;
    maxByDay[task.dayOfWeek] = sortOrder + 1;

    return {
      organizationId: orgId,
      weekStartDate,
      dayOfWeek: task.dayOfWeek,
      slotLabel: generateSlotLabel(task.dayOfWeek),
      taskType: task.taskType,
      taskName: task.taskName,
      fields: task.fields,
      sortOrder,
      platform: platform || 'free',
      profileId: profileId || null,
      updatedBy: user.name || userId,
    };
  });

  const result = await prisma.schedulerTask.createMany({ data });

  // Activity log
  const modeLabel = mode === 'replace' ? 'replaced all' : mode === 'replace_by_type' ? 'replaced by type' : 'appended';
  await prisma.schedulerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      taskId: null,
      action: 'IMPORTED',
      summary: `Imported ${result.count} tasks (${modeLabel}${deleted > 0 ? `, removed ${deleted} old` : ''}) for week ${weekStart}`,
    },
  });

  // Broadcast real-time update
  await broadcastToScheduler(orgId, {
    type: 'tasks.imported',
    weekStart,
    count: result.count,
  });

  return NextResponse.json({ imported: result.count, deleted }, { status: 201 });
}
