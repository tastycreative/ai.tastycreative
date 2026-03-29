import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/[id]/history?limit=20&cursor=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  // Verify task belongs to org
  const task = await prisma.schedulerTask.findUnique({
    where: { id, organizationId: user.currentOrganizationId },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const url = request.nextUrl;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
  const cursor = url.searchParams.get('cursor') || undefined;

  const items = await prisma.schedulerTaskHistory.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
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
    select: { id: true, name: true, firstName: true, lastName: true, imageUrl: true },
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
      user: (() => {
        const u = userMap.get(item.userId);
        if (!u) return { name: null, imageUrl: null };
        return { name: (u.name && !u.name.startsWith('user_') ? u.name : null) || [u.firstName, u.lastName].filter(Boolean).join(' ') || null, imageUrl: u.imageUrl };
      })(),
    })),
    nextCursor,
  });
}
