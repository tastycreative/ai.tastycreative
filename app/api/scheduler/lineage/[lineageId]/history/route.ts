import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/lineage/[lineageId]/history — aggregated history across all tasks in lineage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lineageId: string }> },
) {
  const { lineageId } = await params;
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

  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '30');
  const cursor = request.nextUrl.searchParams.get('cursor');

  // Find all task IDs in this lineage
  const lineageTasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: user.currentOrganizationId,
      lineageId,
    },
    select: { id: true, weekStartDate: true },
  });

  const taskIds = lineageTasks.map((t) => t.id);
  const weekDateByTaskId = new Map(
    lineageTasks.map((t) => [t.id, t.weekStartDate.toISOString().split('T')[0]]),
  );

  if (taskIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  // Fetch history entries across all tasks
  const items = await prisma.schedulerTaskHistory.findMany({
    where: {
      taskId: { in: taskIds },
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: {
      task: {
        select: { id: true, taskType: true, slotLabel: true, dayOfWeek: true, taskName: true, weekStartDate: true },
      },
    },
  });

  // Fetch user info for the history entries
  const userIds = [...new Set(items.map((i) => i.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, firstName: true, lastName: true, imageUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;

  const result = sliced.map((item) => ({
    id: item.id,
    action: item.action,
    field: item.field,
    oldValue: item.oldValue,
    newValue: item.newValue,
    createdAt: item.createdAt.toISOString(),
    weekStartDate: weekDateByTaskId.get(item.taskId) || item.task?.weekStartDate?.toISOString().split('T')[0] || null,
    user: (() => {
      const u = userMap.get(item.userId);
      if (!u) return { name: null, imageUrl: null };
      return { name: (u.name && !u.name.startsWith('user_') ? u.name : null) || [u.firstName, u.lastName].filter(Boolean).join(' ') || null, imageUrl: u.imageUrl };
    })(),
    task: item.task
      ? {
          id: item.task.id,
          taskType: item.task.taskType,
          slotLabel: item.task.slotLabel,
          dayOfWeek: item.task.dayOfWeek,
          taskName: item.task.taskName,
        }
      : null,
  }));

  return NextResponse.json({
    items: result,
    nextCursor: hasMore ? sliced[sliced.length - 1].createdAt.toISOString() : null,
  });
}
