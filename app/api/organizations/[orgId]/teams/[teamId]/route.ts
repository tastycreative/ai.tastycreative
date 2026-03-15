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

const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const;

// Valid tab permission keys — only these are stored.
const VALID_TAB_KEYS = new Set([
  'hasSpacesTab', 'hasSchedulersTab', 'hasContentTab', 'hasVaultTab',
  'hasReferenceBank', 'canCaptionBank', 'hasInstagramTab', 'hasGenerateTab',
  'hasFeedTab', 'hasTrainingTab', 'hasAIToolsTab', 'hasMarketplaceTab',
]);

function sanitizeTabPermissions(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (VALID_TAB_KEYS.has(k) && typeof v === 'boolean') {
      result[k] = v;
    }
  }
  return result;
}

// ── PATCH /api/organizations/[orgId]/teams/[teamId] ─────────────────────────
// Update team name / description / color / tabPermissions.
// OWNER / ADMIN only.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, teamId } = await params;
    const membership = await getMembership(orgId, userId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(ADMIN_ROLES as readonly string[]).includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the team belongs to this org
    const team = await prisma.orgTeam.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const body = await req.json();
    const { name, description, color, tabPermissions } = body;

    // Check duplicate name if renaming
    if (name && name.trim() !== team.name) {
      const conflict = await prisma.orgTeam.findUnique({
        where: { organizationId_name: { organizationId: orgId, name: name.trim() } },
      });
      if (conflict) {
        return NextResponse.json({ error: 'A team with this name already exists' }, { status: 409 });
      }
    }

    const updated = await prisma.orgTeam.update({
      where: { id: teamId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() ?? null }),
        ...(color !== undefined && { color }),
        ...(tabPermissions !== undefined && { tabPermissions: sanitizeTabPermissions(tabPermissions) }),
      },
    });

    return NextResponse.json({ team: updated });
  } catch (error) {
    console.error('[PATCH /teams/[teamId]]', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

// ── DELETE /api/organizations/[orgId]/teams/[teamId] ─────────────────────────
// Delete a team. Members are unassigned (OrgTeamMember rows cascade-deleted)
// but remain in the organization. OWNER / ADMIN only.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId, teamId } = await params;
    const membership = await getMembership(orgId, userId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(ADMIN_ROLES as readonly string[]).includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const team = await prisma.orgTeam.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    await prisma.orgTeam.delete({ where: { id: teamId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /teams/[teamId]]', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
