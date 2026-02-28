import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, canViewQueue, isCreatorRole, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg } from '@/lib/ably-server';

async function resolveUserContext(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, currentOrganizationId: true },
  });
  if (!user) return null;

  const membership = user.currentOrganizationId
    ? await prisma.teamMember.findFirst({
        where: { userId: user.id, organizationId: user.currentOrganizationId },
        select: { role: true },
      })
    : null;

  return {
    userId: user.id,
    clerkId,
    organizationId: user.currentOrganizationId ?? null,
    role: (membership?.role ?? null) as OrgRole | null,
  };
}

/**
 * PATCH /api/caption-queue/items/[itemId]
 * Updates the captionText of a single CaptionQueueContentItem.
 * Creators can update items on tickets assigned to them.
 * Managers+ can update any item in their org.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { itemId } = await params;

    // Load the content item + its parent ticket
    const contentItem = await prisma.captionQueueContentItem.findUnique({
      where: { id: itemId },
      include: {
        ticket: {
          include: {
            assignees: { select: { clerkId: true } },
          },
        },
      },
    });

    if (!contentItem) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const ticket = contentItem.ticket;
    const sameOrg = ticket.organizationId && ticket.organizationId === ctx.organizationId;

    if (sameOrg && canManageQueue(ctx.role)) {
      // Full access
    } else if (sameOrg && isCreatorRole(ctx.role)) {
      const isAssigned = ticket.assignees.some((a) => a.clerkId === clerkId);
      if (!isAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (ticket.clerkId === clerkId) {
      // Ticket creator can edit their own items
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!ctx.organizationId || !canViewQueue(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { captionText } = body as { captionText: string };

    const updated = await prisma.captionQueueContentItem.update({
      where: { id: itemId },
      data: { captionText, updatedAt: new Date() },
    });

    // Broadcast update so other org members see the change in real time
    if (ticket.organizationId) {
      await broadcastToOrg(ticket.organizationId, {
        type: 'ITEM_CAPTION_UPDATED',
        ticketId: ticket.id,
        itemId,
        orgId: ticket.organizationId,
        senderClerkId: clerkId,
        captionText,
      });
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Error updating content item caption:', error);
    return NextResponse.json({ error: 'Failed to update caption' }, { status: 500 });
  }
}
