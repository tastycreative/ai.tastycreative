import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/month?month=2026-03&profileId=xxx
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

  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
  }

  const profileId = request.nextUrl.searchParams.get('profileId');

  // Optional date-range override: if startDate + endDate are provided,
  // return tasks whose computed date falls within that range instead of the calendar month.
  // Used by the calendar grid to fetch only the visible date range (including leading/trailing days).
  const startDateParam = request.nextUrl.searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = request.nextUrl.searchParams.get('endDate');     // YYYY-MM-DD

  // Calculate date range: first day of month to last day of month
  // We need to find all weekStartDates that could contain tasks for days in this month
  const [year, mon] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd = new Date(Date.UTC(year, mon, 0)); // last day of month

  // If a custom date range is given, expand the DB query range to cover it
  const filterStart = startDateParam ? new Date(startDateParam + 'T00:00:00Z') : monthStart;
  const filterEnd = endDateParam ? new Date(endDateParam + 'T00:00:00Z') : monthEnd;

  // weekStartDate could be up to 6 days before the earliest visible date
  const rangeStart = new Date(filterStart);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
  const rangeEnd = new Date(filterEnd);

  const tasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      ...(profileId && { profileId }),
    },
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
  });

  // Filter to only tasks whose actual date falls within the visible range
  const filtered = tasks.filter((task) => {
    const ws = new Date(task.weekStartDate);
    const taskDate = new Date(ws);
    taskDate.setUTCDate(taskDate.getUTCDate() + task.dayOfWeek);

    if (startDateParam && endDateParam) {
      // Date-range mode: include if date falls within [startDate, endDate]
      const taskDateKey = taskDate.toISOString().split('T')[0];
      return taskDateKey >= startDateParam && taskDateKey <= endDateParam;
    }

    // Default: filter to the requested month
    const taskMonth = `${taskDate.getUTCFullYear()}-${String(taskDate.getUTCMonth() + 1).padStart(2, '0')}`;
    return taskMonth === month;
  });

  return NextResponse.json({ tasks: filtered });
}
