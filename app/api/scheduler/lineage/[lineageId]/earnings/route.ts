import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/lineage/[lineageId]/earnings — sum finalAmount across lineage
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

  const tasks = await prisma.schedulerTask.findMany({
    where: {
      organizationId: user.currentOrganizationId,
      lineageId,
    },
    select: {
      fields: true,
      weekStartDate: true,
      dayOfWeek: true,
    },
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
  });

  let totalEarnings = 0;
  let filledCount = 0;
  const items: { date: string; finalAmount: string }[] = [];

  for (const task of tasks) {
    const fields = (task.fields as Record<string, string> | null) ?? {};
    const raw = fields.finalAmount || '';
    // Compute task date from weekStartDate + dayOfWeek
    const ws = new Date(task.weekStartDate);
    const d = new Date(ws);
    d.setUTCDate(d.getUTCDate() + task.dayOfWeek);
    const date = d.toISOString().split('T')[0];

    if (raw) {
      const parsed = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
      if (!isNaN(parsed)) {
        totalEarnings += parsed;
        filledCount++;
      }
    }

    items.push({ date, finalAmount: raw });
  }

  return NextResponse.json({
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    taskCount: tasks.length,
    filledCount,
    items,
  });
}
