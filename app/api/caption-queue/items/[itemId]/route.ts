import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, canViewQueue, isCreatorRole, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';

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

    // Determine new per-item captionStatus:
    // - If the item was 'approved', don't allow further edits
    // - If the item was 'not_required', don't allow edits
    // - Otherwise, mark as 'in_progress' when saving a draft
    const currentItemStatus = contentItem.captionStatus;
    if (currentItemStatus === 'approved') {
      return NextResponse.json(
        { error: 'This item has been approved and cannot be edited' },
        { status: 400 },
      );
    }
    if (currentItemStatus === 'not_required') {
      return NextResponse.json(
        { error: 'This item does not require a caption' },
        { status: 400 },
      );
    }

    const newItemStatus = captionText?.trim()
      ? (currentItemStatus === 'rejected' || currentItemStatus === 'pending' ? 'in_progress' : currentItemStatus)
      : currentItemStatus;

    const updated = await prisma.captionQueueContentItem.update({
      where: { id: itemId },
      data: {
        captionText,
        captionStatus: newItemStatus === 'pending' ? 'in_progress' : newItemStatus,
        updatedAt: new Date(),
      },
    });

    // ── Sync per-item captions back to the linked board item ──
    if (ticket.boardItemId) {
      try {
        // Re-fetch all items so we have the latest captions (including the one just saved)
        const allItems = await prisma.captionQueueContentItem.findMany({
          where: { ticketId: ticket.id },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, url: true, fileName: true, captionText: true, captionStatus: true, requiresCaption: true, qaRejectionReason: true },
        });

        const captionItems = allItems.map((ci) => ({
          contentItemId: ci.id,
          url: ci.url,
          fileName: ci.fileName ?? null,
          captionText: ci.id === itemId ? captionText : (ci.captionText ?? null),
          captionStatus: ci.id === itemId ? updated.captionStatus : ci.captionStatus,
          qaRejectionReason: ci.qaRejectionReason ?? null,
        }));

        // Only consider items that require captions
        const actionableItems = captionItems.filter((_, idx) => allItems[idx].requiresCaption);
        const allCaptioned = actionableItems.every((ci) => !!ci.captionText);

        const boardItem = await prisma.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: { metadata: true, columnId: true },
        });
        const prev = (boardItem?.metadata as Record<string, unknown>) ?? {};

        await prisma.boardItem.update({
          where: { id: ticket.boardItemId },
          data: {
            metadata: {
              ...prev,
              captionItems,
              captionStatus: allCaptioned ? 'pending_qa' : 'in_progress',
            },
            updatedAt: new Date(),
          },
        });

        // Notify the board page so it invalidates its cache
        if (boardItem?.columnId) {
          const col = await prisma.boardColumn.findUnique({
            where: { id: boardItem.columnId },
            select: { boardId: true },
          });
          if (col?.boardId) {
            await broadcastToBoard(col.boardId, ticket.boardItemId!);
          }
        }
      } catch (e) {
        console.error('Failed to sync item captions to board item:', e);
      }
    }

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
