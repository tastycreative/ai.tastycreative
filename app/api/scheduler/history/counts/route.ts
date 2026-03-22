import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/history/counts?month=2026-03&profileId=xxx&platform=free
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
  const month = url.searchParams.get('month'); // "2026-03"
  const profileId = url.searchParams.get('profileId') || undefined;
  const platform = url.searchParams.get('platform') || undefined;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Invalid month format (YYYY-MM)' }, { status: 400 });
  }

  const startDate = new Date(`${month}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);

  // Get task IDs that match the org/profile/platform filters
  const taskFilter: Record<string, unknown> = { organizationId: orgId };
  if (profileId) taskFilter.profileId = profileId;
  if (platform) taskFilter.platform = platform;

  const taskIds = await prisma.schedulerTask.findMany({
    where: taskFilter,
    select: { id: true },
  });
  const ids = taskIds.map((t) => t.id);

  if (ids.length === 0) {
    return NextResponse.json({ counts: {} });
  }

  // Raw query to group by date
  const rows = await prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(
    `SELECT DATE("createdAt") as day, COUNT(*)::bigint as count
     FROM scheduler_task_history
     WHERE "taskId" = ANY($1)
       AND "createdAt" >= $2
       AND "createdAt" < $3
     GROUP BY DATE("createdAt")
     ORDER BY day`,
    ids,
    startDate,
    endDate,
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    // day may come as Date or string depending on driver
    const d = row.day as unknown;
    const dayStr = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    counts[dayStr] = Number(row.count);
  }

  return NextResponse.json({ counts });
}
