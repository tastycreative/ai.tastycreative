import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { computeStreaks } from '@/lib/scheduler/streak-utils';

/**
 * POST /api/scheduler/streaks
 * Accepts { lineageIds: string[] }, returns streak counts per lineage per task.
 */
export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const lineageIds: string[] = body.lineageIds;

  if (!Array.isArray(lineageIds) || lineageIds.length === 0) {
    return NextResponse.json({ streaks: {} });
  }

  // Cap to prevent abuse
  const ids = lineageIds.slice(0, 200);

  const tasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      lineageId: { in: ids },
    },
    orderBy: [
      { weekStartDate: 'asc' },
      { dayOfWeek: 'asc' },
    ],
    select: {
      id: true,
      lineageId: true,
      fields: true,
    },
  });

  // Group by lineageId
  const grouped = new Map<string, { id: string; fields: Record<string, unknown> | null }[]>();
  for (const t of tasks) {
    if (!t.lineageId) continue;
    let arr = grouped.get(t.lineageId);
    if (!arr) {
      arr = [];
      grouped.set(t.lineageId, arr);
    }
    arr.push({ id: t.id, fields: t.fields as Record<string, unknown> | null });
  }

  // Compute streaks per group
  const streaks: Record<string, Record<string, number>> = {};
  for (const [lineageId, group] of grouped) {
    const streakMap = computeStreaks(group);
    const obj: Record<string, number> = {};
    for (const [taskId, count] of streakMap) {
      obj[taskId] = count;
    }
    streaks[lineageId] = obj;
  }

  return NextResponse.json({ streaks });
}
