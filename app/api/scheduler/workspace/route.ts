import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/workspace?filter=flagged|missing-amount&profileId=xxx&limit=20&cursor=xxx
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
  const sp = request.nextUrl.searchParams;
  const filter = sp.get('filter') as 'flagged' | 'missing-amount' | null;
  const profileId = sp.get('profileId');
  const limit = Math.min(parseInt(sp.get('limit') || '20', 10), 100);
  const cursor = sp.get('cursor');

  if (!filter || !['flagged', 'missing-amount'].includes(filter)) {
    return NextResponse.json({ error: 'Invalid filter param' }, { status: 400 });
  }

  const baseWhere: Record<string, unknown> = {
    organizationId: orgId,
  };
  if (profileId) baseWhere.profileId = profileId;

  if (filter === 'flagged') {
    // All flagged tasks regardless of date
    baseWhere.fields = { path: ['flagged'], equals: 'true' };

    const [items, totalCount] = await Promise.all([
      prisma.schedulerTask.findMany({
        where: baseWhere,
        orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.schedulerTask.count({ where: baseWhere }),
    ]);

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return NextResponse.json({ items: page, nextCursor, totalCount });
  }

  // filter === 'missing-amount'
  // Fetch all candidate tasks, filter in JS, then use cursor-based pagination (same as flagged).
  const schedulerToday = sp.get('today') || getSchedulerTodayKey();
  const todayDate = new Date(schedulerToday + 'T00:00:00Z');

  const allTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: { lte: todayDate },
      ...(profileId ? { profileId } : {}),
    },
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
  });

  // Filter to unlock tasks with missing finalAmount on past dates (or today if DONE)
  const matching = allTasks.filter((task) => {
    const f = (task.fields || {}) as Record<string, string>;
    const typeName = (f.type || task.taskName || '').toLowerCase();
    if (!typeName.includes('unlock')) return false;
    const ws = new Date(task.weekStartDate);
    const taskDate = new Date(ws);
    taskDate.setUTCDate(taskDate.getUTCDate() + task.dayOfWeek);
    const taskDateKey = taskDate.toISOString().split('T')[0];
    if (taskDateKey > schedulerToday) return false;
    if (taskDateKey === schedulerToday && task.status !== 'DONE') return false;
    const fa = f.finalAmount;
    if (fa !== undefined && fa !== null && fa !== '' && String(fa).trim() !== '') return false;
    return true;
  });

  const totalCount = matching.length;

  // Cursor-based pagination: skip items until we pass the cursor id
  let startIdx = 0;
  if (cursor) {
    const cursorIdx = matching.findIndex((t) => t.id === cursor);
    if (cursorIdx !== -1) startIdx = cursorIdx + 1;
  }

  const page = matching.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < totalCount;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({ items: page, nextCursor, totalCount });
}

function getSchedulerTodayKey(): string {
  const now = new Date();
  const laStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const la = new Date(laStr);
  const hour = la.getHours();
  // Scheduler day advances at 5 PM LA
  if (hour >= 17) {
    la.setDate(la.getDate() + 1);
  }
  const y = la.getFullYear();
  const m = String(la.getMonth() + 1).padStart(2, '0');
  const d = String(la.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
