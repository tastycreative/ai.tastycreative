import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/activity?limit=30&cursor=xxx
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
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '30', 10);
  const cursor = request.nextUrl.searchParams.get('cursor');

  const logs = await prisma.schedulerActivityLog.findMany({
    where: {
      organizationId: orgId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { name: true, firstName: true, lastName: true, imageUrl: true } },
      task: { select: { id: true, taskType: true, slotLabel: true, dayOfWeek: true, taskName: true } },
      changes: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, field: true, oldValue: true, newValue: true, action: true },
      },
    },
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ items, nextCursor });
}
