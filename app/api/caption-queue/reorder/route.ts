import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canViewQueue, type OrgRole } from '@/lib/rbac';

/**
 * PATCH /api/caption-queue/reorder
 *
 * Saves this user's personal sort preference for their caption queue.
 * All roles that can VIEW the queue (OWNER / ADMIN / MANAGER / CREATOR)
 * are allowed to reorder — the order is stored per-user so it does NOT
 * affect what other members see.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json({ error: 'User not in an organization' }, { status: 403 });
    }

    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id, organizationId: user.currentOrganizationId },
      select: { role: true },
    });

    // All view-capable roles (including CREATOR) can reorder their own queue view
    if (!canViewQueue(membership?.role as OrgRole | undefined)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { items } = body as { items: Array<{ id: string; sortOrder: number }> };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Sort by the provided sortOrder to build the ordered list of IDs
    const orderedIds = [...items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.id);

    // Upsert the user's personal order — this does NOT touch any shared ticket data
    await prisma.captionQueueUserOrder.upsert({
      where: { clerkId_orgId: { clerkId, orgId: user.currentOrganizationId } },
      update: { ticketIds: orderedIds },
      create: {
        clerkId,
        orgId: user.currentOrganizationId,
        ticketIds: orderedIds,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering queue items:', error);
    return NextResponse.json({ error: 'Failed to reorder queue items' }, { status: 500 });
  }
}