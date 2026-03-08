import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/page-tracker/export — export tracker data as CSV
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

  // Verify membership
  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
  }

  const entries = await prisma.pageTrackerEntry.findMany({
    where: { organizationId: orgId },
    include: {
      profile: { select: { name: true, instagramUsername: true } },
      team: { select: { name: true } },
    },
    orderBy: [{ team: { name: 'asc' } }, { profile: { name: 'asc' } }],
  });

  // Build CSV
  const headers = ['Model/Page', 'Instagram', 'Team', 'Platform', 'Managing System', 'Status', 'Notes', 'Last Updated'];
  const escapeCSV = (val: string | null | undefined) => {
    if (!val) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = entries.map((e) => [
    escapeCSV(e.profile.name),
    escapeCSV(e.profile.instagramUsername),
    escapeCSV(e.team?.name),
    escapeCSV(e.platformType),
    escapeCSV(e.managingSystem),
    escapeCSV(e.trackerStatus),
    escapeCSV(e.notes),
    e.updatedAt.toISOString().split('T')[0],
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tracker-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
