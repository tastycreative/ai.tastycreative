import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/pod-tracker?weekStart=2024-01-01
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

  const weekStart = request.nextUrl.searchParams.get('weekStart');
  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart param required' }, { status: 400 });
  }

  const tasks = await prisma.podTrackerTask.findMany({
    where: {
      organizationId: orgId,
      weekStartDate: new Date(weekStart),
    },
    orderBy: [{ dayOfWeek: 'asc' }, { slotLabel: 'asc' }],
  });

  return NextResponse.json({ tasks });
}
