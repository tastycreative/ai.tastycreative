import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/page-tracker/paused-models — fetch all ON PAUSE entries with their model name + pausedContentStyles
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

  const pausedEntries = await prisma.pageTrackerEntry.findMany({
    where: {
      organizationId: orgId,
      trackerStatus: 'ON PAUSE',
    },
    select: {
      pausedContentStyles: true,
      profile: {
        select: { name: true },
      },
    },
  });

  const pausedModels = pausedEntries.map((entry) => ({
    modelName: entry.profile.name,
    pausedContentStyles: entry.pausedContentStyles,
  }));

  return NextResponse.json({ pausedModels });
}
