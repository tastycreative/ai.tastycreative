import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH /api/page-tracker/[id] — update a tracker entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

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

  // Verify entry belongs to org
  const existing = await prisma.pageTrackerEntry.findFirst({
    where: { id, organizationId: orgId },
    include: { profile: { select: { name: true } }, team: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await request.json();
  const { teamId, platformType, managingSystem, trackerStatus, notes } = body;

  // Build change details
  const changes: string[] = [];
  if (trackerStatus !== undefined && trackerStatus !== existing.trackerStatus) changes.push(`status: ${existing.trackerStatus} → ${trackerStatus}`);
  if (platformType !== undefined && platformType !== existing.platformType) changes.push(`platform: ${existing.platformType || '—'} → ${platformType || '—'}`);
  if (managingSystem !== undefined && managingSystem !== existing.managingSystem) changes.push(`system: ${existing.managingSystem || '—'} → ${managingSystem || '—'}`);
  if (teamId !== undefined && teamId !== existing.teamId) changes.push(`team reassigned`);
  if (notes !== undefined && notes !== existing.notes) changes.push(`notes updated`);

  const entry = await prisma.pageTrackerEntry.update({
    where: { id },
    data: {
      ...(teamId !== undefined && { teamId: teamId || null }),
      ...(platformType !== undefined && { platformType }),
      ...(managingSystem !== undefined && { managingSystem }),
      ...(trackerStatus !== undefined && { trackerStatus }),
      ...(notes !== undefined && { notes }),
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
  if (changes.length > 0) {
    await prisma.trackerActivityLog.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        action: 'UPDATED',
        entityType: 'entry',
        entityId: id,
        entityName: existing.profile.name,
        details: `Updated "${existing.profile.name}": ${changes.join(', ')}`,
      },
    });
  }

  return NextResponse.json(entry);
}

// DELETE /api/page-tracker/[id] — remove a tracker entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

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

  const existing = await prisma.pageTrackerEntry.findFirst({
    where: { id, organizationId: orgId },
    include: { profile: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  await prisma.pageTrackerEntry.delete({ where: { id } });

  // Log activity
  await prisma.trackerActivityLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      action: 'REMOVED',
      entityType: 'entry',
      entityId: id,
      entityName: existing.profile.name,
      details: `Removed "${existing.profile.name}" from tracker`,
    },
  });

  return NextResponse.json({ success: true });
}
