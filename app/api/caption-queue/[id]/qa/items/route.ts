import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, canQAInSpace, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import {
  WALL_POST_STATUS,
  deriveTicketStatus,
  captionStatusToWallPostStatus,
  MAX_REVISIONS_PER_ITEM,
} from '@/lib/wall-post-status';

/**
 * PATCH /api/caption-queue/[id]/qa/items
 *
 * Per-content-item QA approve or reject.
 *
 * Body:
 *   items: Array<{
 *     contentItemId: string;
 *     action: 'approve' | 'reject';
 *     reason?: string;       // required when rejecting
 *   }>
 *
 * Supports partial approval: some items can be approved while others
 * are rejected in the same call. Rejected items go back to the captioner
 * with the rejection reason; approved items are locked.
 *
 * The ticket's overall status is derived from the aggregate of all content
 * item statuses using `deriveTicketStatus()`.
 *
 * Only OWNER / ADMIN / MANAGER can perform QA actions.
 */

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!ctx.organizationId) {
      return NextResponse.json(
        { error: 'Forbidden: No organization context' },
        { status: 403 },
      );
    }

    const { id: ticketId } = await params;
    const body = await request.json();
    const { items } = body as {
      items: Array<{ contentItemId: string; action: 'approve' | 'reject' | 'revert'; reason?: string }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    // Validate every item has a valid action + reject items have a reason
    for (const item of items) {
      if (!['approve', 'reject', 'revert'].includes(item.action)) {
        return NextResponse.json(
          { error: `Invalid action "${item.action}" for item ${item.contentItemId}` },
          { status: 400 },
        );
      }
    }

    // ── Load ticket + all content items ──
    const ticket = await prisma.captionQueueTicket.findUnique({
      where: { id: ticketId },
      include: {
        assignees: { select: { clerkId: true } },
        contentItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check space-level role first, then fall back to org-level role
    let hasSpaceQA = false;
    if (ticket.boardItemId) {
      const boardItem = await prisma.boardItem.findUnique({
        where: { id: ticket.boardItemId },
        select: { column: { select: { board: { select: { workspace: { select: { members: { where: { userId: ctx.userId }, select: { role: true }, take: 1 } } } } } } } },
      });
      const spaceRole = boardItem?.column?.board?.workspace?.members?.[0]?.role ?? null;
      hasSpaceQA = canQAInSpace(spaceRole);
    }
    if (!hasSpaceQA && !canManageQueue(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owners, Admins, and Managers can perform QA actions' },
        { status: 403 },
      );
    }

    // Only tickets that have at least some submitted/pending_qa items can be QA'd.
    // Revert-only requests are exempt from this check — the item-level validation
    // ensures only truly approved/rejected items can be reverted.
    const hasNonRevertActions = items.some((i) => i.action !== 'revert');
    if (hasNonRevertActions) {
      const validForQA = ['pending_qa', 'partially_approved'].includes(ticket.status);
      if (!validForQA) {
        return NextResponse.json(
          { error: `Ticket is not ready for per-item QA (current status: ${ticket.status})` },
          { status: 400 },
        );
      }
    }

    // Build a map of content item IDs for validation
    const contentItemMap = new Map(ticket.contentItems.map((ci) => [ci.id, ci]));
    for (const item of items) {
      if (!contentItemMap.has(item.contentItemId)) {
        return NextResponse.json(
          { error: `Content item ${item.contentItemId} not found on this ticket` },
          { status: 404 },
        );
      }
      const ci = contentItemMap.get(item.contentItemId)!;
      // Revert: only approved/rejected can be reverted back to submitted
      if (item.action === 'revert') {
        if (!['approved', 'rejected'].includes(ci.captionStatus)) {
          return NextResponse.json(
            {
              error: `Content item ${item.contentItemId} cannot be reverted (current: ${ci.captionStatus}). Only approved or rejected items can be reverted.`,
            },
            { status: 400 },
          );
        }
        continue; // skip remaining validations for revert
      }
      // Only submitted items can be approved/rejected
      if (ci.captionStatus !== 'submitted') {
        return NextResponse.json(
          {
            error: `Content item ${item.contentItemId} is not in "submitted" status (current: ${ci.captionStatus})`,
          },
          { status: 400 },
        );
      }
      // Prevent infinite revision loops
      if (item.action === 'reject' && ci.revisionCount >= MAX_REVISIONS_PER_ITEM) {
        return NextResponse.json(
          {
            error: `Content item ${item.contentItemId} has reached the maximum revision limit (${MAX_REVISIONS_PER_ITEM})`,
          },
          { status: 400 },
        );
      }
    }

    // ── Atomic transaction ──
    const result = await prisma.$transaction(async (tx) => {
      const results: Array<{ contentItemId: string; action: string; captionStatus: string }> = [];

      for (const item of items) {
        const isApprove = item.action === 'approve';
        const isRevert = item.action === 'revert';
        const newItemStatus = isRevert ? 'submitted' : (isApprove ? 'approved' : 'rejected');

        // Update the content item
        await tx.captionQueueContentItem.update({
          where: { id: item.contentItemId },
          data: {
            captionStatus: newItemStatus,
            ...(isRevert
              ? {
                  // Clear both approve and reject metadata
                  qaApprovedAt: null,
                  qaApprovedBy: null,
                  qaRejectionReason: null,
                  qaRejectedAt: null,
                  qaRejectedBy: null,
                }
              : isApprove
                ? {
                    qaApprovedAt: new Date(),
                    qaApprovedBy: clerkId,
                    qaRejectionReason: null,
                    qaRejectedAt: null,
                    qaRejectedBy: null,
                  }
                : {
                    qaRejectionReason: item.reason!.trim(),
                    qaRejectedAt: new Date(),
                    qaRejectedBy: clerkId,
                    revisionCount: { increment: 1 },
                  }),
            updatedAt: new Date(),
          },
        });

        // Record revision history
        const ci = contentItemMap.get(item.contentItemId)!;
        await tx.captionRevisionHistory.create({
          data: {
            contentItemId: item.contentItemId,
            revisionNumber: ci.revisionCount + (isApprove || isRevert ? 0 : 1),
            captionText: ci.captionText ?? '',
            action: item.action,
            reason: item.reason?.trim() || (isRevert ? 'Reverted to pending QA' : null),
            performedBy: clerkId,
          },
        });

        results.push({
          contentItemId: item.contentItemId,
          action: item.action,
          captionStatus: newItemStatus,
        });
      }

      // Re-fetch all content items to derive the new ticket status
      const allItems = await tx.captionQueueContentItem.findMany({
        where: { ticketId },
        orderBy: { sortOrder: 'asc' },
      });

      // Rejected items stay as 'rejected' — they will be re-pushed explicitly
      // by the QA reviewer via the "Re-push to Caption" action.

      // Derive ticket status from all item statuses
      const finalItems = allItems;
      const itemStatuses = finalItems.map((ci) => ci.captionStatus);
      const newTicketStatus = deriveTicketStatus(itemStatuses);

      // Update ticket status
      const updatedTicket = await tx.captionQueueTicket.update({
        where: { id: ticketId },
        data: {
          status: newTicketStatus,
          ...(newTicketStatus === 'completed' ? { completedAt: new Date() } : {}),
          updatedAt: new Date(),
        },
        include: {
          assignees: { select: { clerkId: true } },
          contentItems: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              url: true,
              sourceType: true,
              fileName: true,
              fileType: true,
              sortOrder: true,
              captionText: true,
              requiresCaption: true,
              captionStatus: true,
              qaRejectionReason: true,
              qaRejectedAt: true,
              qaRejectedBy: true,
              qaApprovedAt: true,
              qaApprovedBy: true,
              revisionCount: true,
            },
          },
        },
      });

      // Sync board item metadata
      if (ticket.boardItemId) {
        const boardItem = await tx.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: { metadata: true, column: { select: { boardId: true } } },
        });

        if (boardItem) {
          const prevMeta = (boardItem.metadata as Record<string, unknown>) ?? {};

          const newWallPostStatus = captionStatusToWallPostStatus(newTicketStatus)
            || WALL_POST_STATUS.IN_CAPTION;

          // Build enriched captionItems for the board item
          const captionItems = finalItems.map((ci) => ({
            contentItemId: ci.id,
            url: ci.url,
            fileName: ci.fileName ?? null,
            captionText: ci.captionText ?? null,
            captionStatus: ci.captionStatus,
            qaRejectionReason: ci.qaRejectionReason ?? null,
            isPosted: ci.isPosted,
          }));

          // Build combined captionText from approved items
          const combined = finalItems
            .filter((ci) => ci.captionStatus === 'approved' || ci.captionStatus === 'submitted')
            .map((ci, idx, arr) =>
              arr.length > 1
                ? `[${ci.sortOrder + 1}] ${ci.captionText ?? ''}`
                : (ci.captionText ?? ''),
            )
            .filter(Boolean)
            .join('\n\n');

          const updatedMeta: Record<string, unknown> = {
            ...prevMeta,
            wallPostStatus: newWallPostStatus,
            captionStatus: newTicketStatus,
            captionItems,
            ...(combined.trim() ? { captionText: combined.trim() } : {}),
          };

          // On full completion, set QA approved fields
          if (newTicketStatus === 'completed') {
            updatedMeta.qaApprovedAt = new Date().toISOString();
            updatedMeta.qaApprovedBy = clerkId;
            updatedMeta.qaRejectionReason = null;
            updatedMeta.qaRejectedAt = null;
            updatedMeta.qaRejectedBy = null;
          }

          await tx.boardItem.update({
            where: { id: ticket.boardItemId },
            data: { metadata: updatedMeta as any, updatedAt: new Date() },
          });
        }
      }

      return { ticket: updatedTicket, results, ticketStatus: newTicketStatus, finalItems };
    });

    // Build captionItems for the response
    const captionItems = result.finalItems.map((ci) => ({
      contentItemId: ci.id,
      url: ci.url,
      fileName: ci.fileName ?? null,
      captionText: ci.captionText ?? null,
      captionStatus: ci.captionStatus,
      qaRejectionReason: ci.qaRejectionReason ?? null,
      isPosted: ci.isPosted,
    }));

    // Derive wall post status for response
    const newWallPostStatus = captionStatusToWallPostStatus(result.ticketStatus)
      || WALL_POST_STATUS.IN_CAPTION;

    // ── Real-time broadcasts ──
    if (ctx.organizationId) {
      await broadcastToOrg(ctx.organizationId, {
        type: 'TICKET_UPDATED',
        ticketId,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        status: result.ticketStatus,
        qaAction: 'per_item',
      });
    }

    if (ticket.boardItemId) {
      try {
        const boardItem = await prisma.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: { column: { select: { boardId: true } } },
        });
        if (boardItem?.column?.boardId) {
          await broadcastToBoard(boardItem.column.boardId, ticket.boardItemId);
        }
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({
      ticket: result.ticket,
      results: result.results,
      ticketStatus: result.ticketStatus,
      wallPostStatus: newWallPostStatus,
      captionItems,
    });
  } catch (error) {
    console.error('Error performing per-item QA action:', error);
    return NextResponse.json(
      { error: 'Failed to process per-item QA action' },
      { status: 500 },
    );
  }
}
