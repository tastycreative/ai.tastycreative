import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/page-tracker/config — fetch tracker config (custom dropdown options)
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { currentOrganizationId: true },
  });
  if (!user?.currentOrganizationId) {
    return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
  }

  const config = await prisma.trackerConfig.findUnique({
    where: { organizationId: user.currentOrganizationId },
  });

  // Return defaults if no config exists
  return NextResponse.json(config || {
    customStatuses: [],
    customPlatforms: [],
    customSystems: [],
  });
}

// PUT /api/page-tracker/config — update tracker config
export async function PUT(request: NextRequest) {
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
  if (!member || !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const { customStatuses, customPlatforms, customSystems } = body;

  const config = await prisma.trackerConfig.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      customStatuses: Array.isArray(customStatuses) ? customStatuses : [],
      customPlatforms: Array.isArray(customPlatforms) ? customPlatforms : [],
      customSystems: Array.isArray(customSystems) ? customSystems : [],
    },
    update: {
      ...(customStatuses !== undefined && { customStatuses: Array.isArray(customStatuses) ? customStatuses : [] }),
      ...(customPlatforms !== undefined && { customPlatforms: Array.isArray(customPlatforms) ? customPlatforms : [] }),
      ...(customSystems !== undefined && { customSystems: Array.isArray(customSystems) ? customSystems : [] }),
    },
  });

  return NextResponse.json(config);
}
