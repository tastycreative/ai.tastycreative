import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ orgId: string; teamId: string; memberId: string }> };

async function getMembership(orgId: string, clerkId: string) {
  return prisma.teamMember.findFirst({
    where: { organizationId: orgId, user: { clerkId } },
    select: { id: true, role: true },
  });
}

const MANAGER_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

// ── DELETE /api/organizations/[orgId]/teams/[teamId]/members/[memberId] ─────
// Remove an OrgTeamMember row. OWNER / ADMIN / MANAGER.
// [memberId] is the OrgTeamMember.id.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, teamId, memberId } = await params;
    const remover = await getMembership(orgId, userId);
    if (!remover) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(MANAGER_ROLES as readonly string[]).includes(remover.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the record belongs to this team (which belongs to this org)
    const record = await prisma.orgTeamMember.findFirst({
      where: { id: memberId, teamId, team: { organizationId: orgId } },
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.orgTeamMember.delete({ where: { id: memberId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /teams/[teamId]/members/[memberId]]', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}
