import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ orgId: string; teamId: string }> };

async function getMembership(orgId: string, clerkId: string) {
  return prisma.teamMember.findFirst({
    where: { organizationId: orgId, user: { clerkId } },
    select: { id: true, role: true },
  });
}

const MANAGER_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

// ── GET /api/organizations/[orgId]/teams/[teamId]/members ────────────────────
// List all members of a team. OWNER / ADMIN / MANAGER.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, teamId } = await params;
    const membership = await getMembership(orgId, userId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(MANAGER_ROLES as readonly string[]).includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify team belongs to org
    const team = await prisma.orgTeam.findFirst({ where: { id: teamId, organizationId: orgId } });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const members = await prisma.orgTeamMember.findMany({
      where: { teamId },
      include: {
        teamMember: {
          include: {
            user: {
              select: { id: true, clerkId: true, firstName: true, lastName: true, imageUrl: true, email: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('[GET /teams/[teamId]/members]', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

// ── POST /api/organizations/[orgId]/teams/[teamId]/members ───────────────────
// Add org members to a team. OWNER / ADMIN / MANAGER.
// Body: { teamMemberId } or { teamMemberIds: string[] } for batch
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, teamId } = await params;
    const assigner = await getMembership(orgId, userId);
    if (!assigner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(MANAGER_ROLES as readonly string[]).includes(assigner.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify team belongs to org
    const team = await prisma.orgTeam.findFirst({ where: { id: teamId, organizationId: orgId } });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const body = await req.json();
    const ids: string[] = body.teamMemberIds ?? (body.teamMemberId ? [body.teamMemberId] : []);
    if (ids.length === 0) return NextResponse.json({ error: 'teamMemberId or teamMemberIds is required' }, { status: 400 });

    // Verify all target TeamMembers belong to the same org
    const targets = await prisma.teamMember.findMany({
      where: { id: { in: ids }, organizationId: orgId },
      select: { id: true },
    });
    const validIds = new Set(targets.map(t => t.id));
    const toAdd = ids.filter(id => validIds.has(id));
    const skipped = ids.filter(id => !validIds.has(id));

    if (toAdd.length === 0) {
      return NextResponse.json({ error: 'No valid members found in this organization', skipped }, { status: 404 });
    }

    // Batch upsert
    const results = await Promise.all(
      toAdd.map(teamMemberId =>
        prisma.orgTeamMember.upsert({
          where: { teamId_teamMemberId: { teamId, teamMemberId } },
          create: { teamId, teamMemberId, assignedBy: userId },
          update: { assignedBy: userId },
        })
      )
    );

    return NextResponse.json({
      members: results,
      added: results.length,
      ...(skipped.length > 0 && { skipped }),
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /teams/[teamId]/members]', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}
