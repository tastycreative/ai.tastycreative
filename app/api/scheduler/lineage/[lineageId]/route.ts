import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/scheduler/lineage/[lineageId] — fetch all tasks sharing same lineageId
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
    orderBy: [{ weekStartDate: 'asc' }, { dayOfWeek: 'asc' }],
  });

  return NextResponse.json({ tasks });
}
