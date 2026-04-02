import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * GET /api/scheduler/sibling?taskId=xxx
 * Finds the sibling Unlock ↔ Follow Up MM task.
 *
 * Uses the same positional algorithm as SchedulerGrid's bidirectional sync:
 * 1. Get all MM tasks for the same week/day/profile/platform, sorted by sortOrder
 * 2. Walk backward from Follow Up to find preceding Unlock (or forward from Unlock to find Follow Up)
 */
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

  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  const task = await prisma.schedulerTask.findFirst({
    where: { id: taskId, organizationId: user.currentOrganizationId },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const fields = (task.fields || {}) as Record<string, string>;
  const typeName = (fields.type || task.taskName || '').toLowerCase();
  const isFollowUp = typeName.includes('follow up') || typeName.includes('follow-up');
  const isUnlock = typeName.includes('unlock');

  if (!isFollowUp && !isUnlock) {
    return NextResponse.json({ sibling: null });
  }

  // Get all MM tasks for the same slot, sorted by sortOrder (same as SchedulerGrid)
  const mmTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: user.currentOrganizationId,
      weekStartDate: task.weekStartDate,
      dayOfWeek: task.dayOfWeek,
      profileId: task.profileId,
      platform: task.platform,
      taskType: 'MM',
    },
    orderBy: [{ sortOrder: 'asc' }, { slotLabel: 'asc' }],
  });

  const taskIdx = mmTasks.findIndex((t) => t.id === taskId);
  if (taskIdx < 0) {
    return NextResponse.json({ sibling: null });
  }

  let sibling = null;

  if (isFollowUp) {
    // Walk backward to find the preceding Unlock
    for (let i = taskIdx - 1; i >= 0; i--) {
      const prev = mmTasks[i];
      const f = (prev.fields || {}) as Record<string, string>;
      const t = (f.type || prev.taskName || '').toLowerCase();
      if (t.includes('unlock')) {
        sibling = prev;
        break;
      }
    }
  } else if (isUnlock) {
    // Walk forward to find the next Follow Up
    for (let i = taskIdx + 1; i < mmTasks.length; i++) {
      const next = mmTasks[i];
      const f = (next.fields || {}) as Record<string, string>;
      const t = (f.type || next.taskName || '').toLowerCase();
      if (t.includes('follow up') || t.includes('follow-up')) {
        sibling = next;
        break;
      } else if (t.includes('unlock')) {
        // Hit another unlock group — stop
        break;
      }
    }
  }

  return NextResponse.json({ sibling: sibling || null });
}
