import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ orgId: string }> };

/** Resolve the current user's TeamMember row for this org. */
async function getMembership(orgId: string, clerkId: string) {
  return prisma.teamMember.findFirst({
    where: { organizationId: orgId, user: { clerkId } },
    select: { id: true, role: true },
  });
}

const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const;
const MANAGER_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

// Valid tab permission keys — only these are stored.
const VALID_TAB_KEYS = new Set([
  'hasSpacesTab', 'hasSchedulersTab', 'hasContentTab', 'hasVaultTab',
  'hasReferenceBank', 'canCaptionBank', 'hasInstagramTab', 'hasGenerateTab',
  'hasFeedTab', 'hasTrainingTab', 'hasAIToolsTab', 'hasMarketplaceTab',
]);

/** Strip unknown keys from incoming tabPermissions. */
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

// ── GET /api/organizations/[orgId]/teams ─────────────────────────────────────
// Returns all teams in the org with member counts.
// Accessible to OWNER / ADMIN / MANAGER.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId } = await params;
    const membership = await getMembership(orgId, userId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(MANAGER_ROLES as readonly string[]).includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const teams = await prisma.orgTeam.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: true } },
        members: {
          include: {
            teamMember: {
              include: {
                user: {
                  select: { id: true, clerkId: true, firstName: true, lastName: true, imageUrl: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('[GET /teams]', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

// ── POST /api/organizations/[orgId]/teams ────────────────────────────────────
// Creates a new team. OWNER / ADMIN only.
// Body: { name, description?, color?, tabPermissions? }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orgId } = await params;
    const membership = await getMembership(orgId, userId);
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!(ADMIN_ROLES as readonly string[]).includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden: only OWNER/ADMIN can create teams' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, color, tabPermissions } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Check for duplicate name within this org
    const existing = await prisma.orgTeam.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: name.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'A team with this name already exists' }, { status: 409 });
    }

    const team = await prisma.orgTeam.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description?.trim() ?? null,
        color: color ?? null,
        tabPermissions: sanitizeTabPermissions(tabPermissions),
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('[POST /teams]', error);
    return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
  }
}
