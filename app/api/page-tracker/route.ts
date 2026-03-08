import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/page-tracker — fetch all tracker entries for the user's org
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

  // Verify user is a member of this org
  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
  }

  // Fetch teams with their entries, and also ungrouped entries
  const [teams, entries, config, orgProfiles] = await Promise.all([
    prisma.trackerTeam.findMany({
      where: { organizationId: orgId },
      orderBy: { order: 'asc' },
    }),
    prisma.pageTrackerEntry.findMany({
      where: { organizationId: orgId },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            instagramUsername: true,
            status: true,
            type: true,
          },
        },
        team: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.trackerConfig.findUnique({
      where: { organizationId: orgId },
    }),
    // Get all org profiles that don't have tracker entries yet (for "add" dropdown)
    prisma.instagramProfile.findMany({
      where: {
        organizationId: orgId,
        trackerEntry: { is: null },
      },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
        instagramUsername: true,
        type: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({
    teams,
    entries,
    config,
    unassignedProfiles: orgProfiles,
  });
}

// POST /api/page-tracker — create or bulk-create tracker entries
export async function POST(request: NextRequest) {
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

  // Verify admin/manager role
  const member = await prisma.teamMember.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { profileId, teamId, platformType, managingSystem, trackerStatus, notes } = body;

  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  // Verify profile belongs to org
  const profile = await prisma.instagramProfile.findFirst({
    where: { id: profileId, organizationId: orgId },
  });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found in this organization' }, { status: 404 });
  }

  const entry = await prisma.pageTrackerEntry.create({
    data: {
      profileId,
      teamId: teamId || null,
      platformType: platformType || null,
      managingSystem: managingSystem || null,
      trackerStatus: trackerStatus || 'ACTIVE',
      notes: notes || null,
      organizationId: orgId,
    },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
          instagramUsername: true,
          status: true,
          type: true,
        },
      },
      team: {
        select: { id: true, name: true, color: true },
      },
    },
  });

  // Log activity
  await prisma.trackerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: 'ADDED',
      entityType: 'entry',
      entityId: entry.id,
      entityName: profile.name,
      details: `Added "${profile.name}" to tracker`,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
