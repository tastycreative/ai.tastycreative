import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/history?date=2026-03-21&profileId=xxx&platform=free&limit=30&cursor=xxx
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
  const url = request.nextUrl;
  const date = url.searchParams.get('date'); // "2026-03-21"
  const profileId = url.searchParams.get('profileId') || undefined;
  const platform = url.searchParams.get('platform') || undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 50);
  const cursor = url.searchParams.get('cursor') || undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
  }

  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // Build task filter
  const taskFilter: Record<string, unknown> = { organizationId: orgId };
  if (profileId) taskFilter.profileId = profileId;
  if (platform) taskFilter.platform = platform;

  // Find history entries that were created on this date
  const items = await prisma.schedulerTaskHistory.findMany({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
      task: taskFilter,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      task: {
        select: { id: true, taskType: true, slotLabel: true, dayOfWeek: true, taskName: true },
      },
    },
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    nextCursor = items[limit].id;
    items.pop();
  }

  // Batch-fetch user info
  const userIds = [...new Set(items.map((i) => i.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, imageUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      action: item.action,
      field: item.field,
      oldValue: item.oldValue,
      newValue: item.newValue,
      createdAt: item.createdAt.toISOString(),
      user: userMap.get(item.userId) ?? { name: null, imageUrl: null },
      task: item.task ? { id: item.task.id, taskType: item.task.taskType, slotLabel: item.task.slotLabel, dayOfWeek: item.task.dayOfWeek, taskName: item.task.taskName } : null,
    })),
    nextCursor,
  });
}
