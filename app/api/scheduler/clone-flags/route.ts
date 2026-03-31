import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { broadcastToScheduler } from '@/lib/ably-server';

/**
 * POST /api/scheduler/clone-flags
 *
 * Clones only the flagged status from source week tasks to matching tasks
 * (by lineageId) in the target week. Does NOT create new tasks — only sets
 * flagged: 'true' on existing target-week tasks whose lineage counterpart
 * is flagged in the source week.
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
  const { sourceWeekStart, targetWeekStart, profileId, platform } = body as {
    sourceWeekStart: string;
    targetWeekStart: string;
    profileId?: string | null;
    platform?: string;
  };

  if (!sourceWeekStart || !targetWeekStart) {
    return NextResponse.json(
      { error: 'sourceWeekStart and targetWeekStart required' },
      { status: 400 },
    );
  }

  if (sourceWeekStart === targetWeekStart) {
    return NextResponse.json(
      { error: 'Source and target week must be different' },
      { status: 400 },
    );
  }

  // Fetch source week tasks that are flagged
  const sourceTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(sourceWeekStart),
      ...(profileId && { profileId }),
      ...(platform && { platform }),
    },
    select: { id: true, lineageId: true, dayOfWeek: true, fields: true },
  });

  // Filter to only flagged tasks with a lineageId
  const flaggedSource = sourceTasks.filter((t) => {
    const fields = t.fields as Record<string, unknown> | null;
    return t.lineageId && (fields?.flagged === 'true' || fields?.flagged === true);
  });

  if (flaggedSource.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No flagged tasks found in source week' });
  }

  const flaggedLineageIds = flaggedSource.map((t) => t.lineageId!);

  // Fetch target week tasks that match by lineageId
  const targetTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(targetWeekStart),
      lineageId: { in: flaggedLineageIds },
      ...(profileId && { profileId }),
      ...(platform && { platform }),
    },
    select: { id: true, lineageId: true, fields: true },
  });

  if (targetTasks.length === 0) {
    return NextResponse.json({
      updated: 0,
      flaggedInSource: flaggedSource.length,
      message: 'No matching tasks found in target week',
    });
  }

  // Update each target task — set flagged: 'true' in fields JSON
  let updated = 0;
  await Promise.all(
    targetTasks.map(async (task) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = { ...(task.fields as any || {}), flagged: 'true' };
      try {
        await prisma.schedulerTask.update({
          where: { id: task.id },
          data: { fields },
        });
        updated++;
      } catch (err) {
        console.error(`[clone-flags] Failed to flag task ${task.id}:`, err);
      }
    }),
  );

  // Broadcast task refresh so all users' grids update
  await broadcastToScheduler(orgId, {
    type: 'tasks.seeded',
    tabId: '__server__',
  });

  // Activity log
  const userName =
    (user.name && !user.name.startsWith('user_') ? user.name : null) ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') || userId;

  await prisma.schedulerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      taskId: null,
      action: 'CLONED_FLAGS',
      summary: `Cloned flagged status for ${updated} task(s) from week ${sourceWeekStart} to ${targetWeekStart} (${flaggedSource.length} flagged in source)`,
    },
  });

  return NextResponse.json({
    updated,
    flaggedInSource: flaggedSource.length,
    matchedInTarget: targetTasks.length,
  });
}
