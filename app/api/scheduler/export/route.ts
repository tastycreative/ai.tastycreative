import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { buildDayCSV, buildWeeklyXlsx, ExportableTask } from '@/lib/scheduler/sheet-export';

// GET /api/scheduler/export?weekStart=...&platform=...&profileId=...&profileName=...&dayOfWeek=...
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

  const params = request.nextUrl.searchParams;
  const weekStart = params.get('weekStart');
  const platform = params.get('platform');
  const profileId = params.get('profileId');
  const profileName = params.get('profileName') ?? 'Schedule';
  const dayOfWeekParam = params.get('dayOfWeek');

  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart param required' }, { status: 400 });
  }

  // Build the base filename: "{ModelName} {Platform} Schedule"
  const platformLabel = platform
    ? platform.charAt(0).toUpperCase() + platform.slice(1)
    : 'Schedule';
  const baseFilename = `${profileName} ${platformLabel} Schedule`;

  // Fetch tasks from DB
  const where = {
    organizationId: orgId,
    weekStartDate: new Date(weekStart),
    ...(profileId && { profileId }),
    ...(platform && { platform }),
    ...(dayOfWeekParam != null && { dayOfWeek: parseInt(dayOfWeekParam, 10) }),
  };

  const tasks = await prisma.schedulerTask.findMany({
    where,
    orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
  });

  // Map DB tasks to exportable format
  const exportTasks: (ExportableTask & { dayOfWeek: number })[] = tasks.map((t) => ({
    taskType: t.taskType,
    fields: (t.fields as Record<string, string>) ?? null,
    dayOfWeek: t.dayOfWeek,
  }));

  // Single day export — return CSV directly as file download
  if (dayOfWeekParam != null) {
    const csv = buildDayCSV(exportTasks);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseFilename}.csv"`,
      },
    });
  }

  // Weekly export — return single .xlsx file with 7 sheet tabs
  const tasksByDay = new Map<number, ExportableTask[]>();
  for (let d = 0; d < 7; d++) tasksByDay.set(d, []);
  for (const t of exportTasks) {
    tasksByDay.get(t.dayOfWeek)?.push(t);
  }

  const xlsxBuffer = await buildWeeklyXlsx(tasksByDay);

  return new NextResponse(xlsxBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${baseFilename}.xlsx"`,
    },
  });
}
