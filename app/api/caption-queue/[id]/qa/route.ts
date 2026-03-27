import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { Prisma } from '@/lib/generated/prisma';
import { canManageQueue, canQAInSpace, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import {
  WALL_POST_STATUS,
  deriveTicketStatus,
  captionStatusToWallPostStatus,
} from '@/lib/wall-post-status';
import { SEXTING_SET_STATUS, captionStatusToSextingSetStatus } from '@/lib/sexting-set-status';
import { autoMoveColumnIfNeeded } from '@/lib/board-auto-column-move';

/**
 * PATCH /api/caption-queue/[id]/qa
 *
 * Bulk QA approve or reject a caption ticket (all content items at once).
 *
 * Body:
 *   action: 'approve' | 'reject'
 *   reason?: string  (required when rejecting)
 *
 * - approve → all items approved, ticket completed, wallPostStatus = COMPLETED
 * - reject  → all items rejected→pending, ticket re-opened, wallPostStatus = REVISION_REQUIRED
 *
 * For per-item approve/reject use /api/caption-queue/[id]/qa/items instead.
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

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    // Fetch ticket with content items
    const ticket = await prisma.captionQueueTicket.findUnique({
      where: { id },
      include: {
        assignees: { select: { clerkId: true } },
        contentItems: { orderBy: { sortOrder: 'asc' } },
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

    // Allow bulk QA from pending_qa or partially_approved
    if (!['pending_qa', 'partially_approved'].includes(ticket.status)) {
      return NextResponse.json(
        { error: `Ticket is not ready for QA (current status: ${ticket.status})` },
        { status: 400 },
      );
    }

    const isApprove = action === 'approve';

    // ── Atomic transaction (extended timeout for large tickets) ──
    const updatedTicket = await prisma.$transaction(async (tx) => {
      // 1. Batch-update ALL eligible content items for QA
      //    On approve: submitted/pending items → approved
      //    On reject: submitted/pending items → rejected
      const eligibleItems = ticket.contentItems.filter(
        (ci) => ci.requiresCaption && ['submitted', 'pending'].includes(ci.captionStatus),
      );

      const eligibleIds = eligibleItems.map((ci) => ci.id);
      const now = new Date();

      if (eligibleIds.length > 0) {
        // Bulk status update instead of per-item loop
        await tx.captionQueueContentItem.updateMany({
          where: { id: { in: eligibleIds } },
          data: {
            captionStatus: isApprove ? 'approved' : 'rejected',
            ...(isApprove
              ? {
                  qaApprovedAt: now,
                  qaApprovedBy: clerkId,
                  qaRejectionReason: null,
                  qaRejectedAt: null,
                  qaRejectedBy: null,
                }
              : {
                  qaRejectionReason: reason,
                  qaRejectedAt: now,
                  qaRejectedBy: clerkId,
                }),
            updatedAt: now,
          },
        });

        // For rejections, increment revisionCount in a separate batch
        if (!isApprove) {
          await tx.$executeRaw`UPDATE "CaptionQueueContentItem" SET "revisionCount" = "revisionCount" + 1 WHERE "id" IN (${Prisma.join(eligibleIds)})`;
        }

        // Bulk-create revision history entries
        await tx.captionRevisionHistory.createMany({
          data: eligibleItems.map((ci) => ({
            contentItemId: ci.id,
            revisionNumber: ci.revisionCount + (isApprove ? 0 : 1),
            captionText: ci.captionText ?? '',
            action,
            reason: reason || null,
            performedBy: clerkId,
          })),
        });
      }

      // 2. Re-fetch all items to derive ticket status correctly
      const allItems = await tx.captionQueueContentItem.findMany({
        where: { ticketId: id },
        orderBy: { sortOrder: 'asc' },
      });
      const newTicketStatus = isApprove
        ? 'completed'
        : deriveTicketStatus(allItems.map((ci) => ci.captionStatus));

      const updated = await tx.captionQueueTicket.update({
        where: { id },
        data: {
          status: newTicketStatus,
          ...(isApprove ? { completedAt: new Date() } : {}),
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
              isPosted: true,
            },
          },
        },
      });

      // 3. Update the linked board item's metadata
      if (ticket.boardItemId) {
        const boardItem = await tx.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: { metadata: true, column: { select: { boardId: true } } },
        });

        if (boardItem) {
          const prevMeta = (boardItem.metadata as Record<string, unknown>) ?? {};

          // Build combined captionText from content items
          const ticketCaptionText = updated.captionText
            || (() => {
              if (!updated.contentItems?.length) return undefined;
              const combined = updated.contentItems
                .map((ci, idx) =>
                  updated.contentItems.length > 1
                    ? `[${idx + 1}] ${ci.captionText ?? ''}`
                    : (ci.captionText ?? ''),
                )
                .filter(Boolean)
                .join('\n\n');
              return combined.trim() || undefined;
            })();

          // Enriched captionItems with per-item status for the board
          const captionItems = updated.contentItems.map((ci) => ({
            contentItemId: ci.id,
            url: ci.url,
            fileName: ci.fileName ?? null,
            captionText: ci.captionText ?? null,
            captionStatus: ci.captionStatus,
            qaRejectionReason: ci.qaRejectionReason ?? null,
            isPosted: ci.isPosted,
          }));

          const isSextingSets = ticket.workflowType === 'sexting_sets';
          const statusField = isSextingSets ? 'sextingSetStatus' : 'wallPostStatus';
          const resolvedStatus = isSextingSets
            ? (captionStatusToSextingSetStatus(newTicketStatus) || (isApprove ? SEXTING_SET_STATUS.QA_APPROVED : SEXTING_SET_STATUS.PARTIALLY_APPROVED))
            : (captionStatusToWallPostStatus(newTicketStatus) || (isApprove ? WALL_POST_STATUS.COMPLETED : WALL_POST_STATUS.PARTIALLY_APPROVED));

          const updatedMeta: Record<string, unknown> = {
            ...prevMeta,
            [statusField]: resolvedStatus,
            captionStatus: newTicketStatus,
            captionItems,
            ...(ticketCaptionText ? { captionText: ticketCaptionText } : {}),
            ...(!isApprove && reason ? {
              qaRejectionReason: reason,
              qaRejectedAt: new Date().toISOString(),
              qaRejectedBy: clerkId,
            } : {}),
            ...(isApprove ? {
              qaApprovedAt: new Date().toISOString(),
              qaApprovedBy: clerkId,
              qaRejectionReason: null,
              qaRejectedAt: null,
              qaRejectedBy: null,
            } : {}),
          };

          await tx.boardItem.update({
            where: { id: ticket.boardItemId },
            data: { metadata: updatedMeta as any, updatedAt: new Date() },
          });
        }
      }

      return { updated, newTicketStatus, allItems };
    }, { timeout: 30000 });

    const isSextingSetsTicket = ticket.workflowType === 'sexting_sets';
    const newWallPostStatus = isSextingSetsTicket
      ? (captionStatusToSextingSetStatus(updatedTicket.newTicketStatus) || (isApprove ? SEXTING_SET_STATUS.QA_APPROVED : SEXTING_SET_STATUS.PARTIALLY_APPROVED))
      : (captionStatusToWallPostStatus(updatedTicket.newTicketStatus) || (isApprove ? WALL_POST_STATUS.COMPLETED : WALL_POST_STATUS.PARTIALLY_APPROVED));

    // ── Auto-move board column based on updated metadata ──
    if (ticket.boardItemId) {
      try {
        const boardItem = await prisma.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: {
            columnId: true,
            metadata: true,
            column: { select: { boardId: true, name: true } },
          },
        });
        if (boardItem?.column) {
          await autoMoveColumnIfNeeded({
            boardItemId: ticket.boardItemId,
            currentColumnId: boardItem.columnId,
            currentColumnName: boardItem.column.name,
            boardId: boardItem.column.boardId,
            metadata: (boardItem.metadata as Record<string, unknown>) ?? {},
            userId: ctx.userId,
          });
        }
      } catch (e) {
        console.error('[auto-column-move] QA bulk action:', e);
      }
    }

    // ── Real-time broadcasts ──
    if (ctx.organizationId) {
      await broadcastToOrg(ctx.organizationId, {
        type: 'TICKET_UPDATED',
        ticketId: id,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        status: updatedTicket.newTicketStatus,
        qaAction: action,
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
      item: updatedTicket.updated,
      action,
      wallPostStatus: newWallPostStatus,
      ...(isSextingSetsTicket ? { sextingSetStatus: newWallPostStatus } : {}),
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    console.error('Error performing QA action:', error);
    return NextResponse.json(
      { error: 'Failed to process QA action' },
      { status: 500 },
    );
  }
}
