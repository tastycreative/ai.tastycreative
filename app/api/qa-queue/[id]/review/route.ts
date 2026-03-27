import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, type OrgRole } from '@/lib/rbac';
import { broadcastToBoard } from '@/lib/ably-server';
import { OTP_PTR_CAPTION_STATUS } from '@/lib/otp-ptr-caption-status';
import { SEXTING_SET_STATUS } from '@/lib/sexting-set-status';

/**
 * PATCH /api/qa-queue/[id]/review
 *
 * QA review action for an OTP/PTR or SEXTING_SETS board item.
 *
 * Body:
 *   action: 'approve' | 'reject_caption' | 'reject_flyer' | 'reject_both'
 *   reason?: string   (optional rejection reason)
 *   qaNotes?: string  (optional QA notes)
 *   campaignOrUnlock?: string  (OTP/PTR only)
 *   totalSale?: number         (OTP/PTR only)
 *
 * approve:
 *   OTP/PTR: moves item to "For Approval" column, sets otpPtrCaptionStatus = APPROVED
 *   SEXTING_SETS: moves item to "Review" column, sets sextingSetStatus = QA_APPROVED
 *
 * reject_caption:
 *   OTP/PTR: moves item back to "PGT Team" column
 *   SEXTING_SETS: moves item back to "Needs Captioning" column
 *   Both: sets caption status to NEEDS_REVISION/REVISION_REQUIRED
 *
 * reject_flyer / reject_both:
 *   OTP/PTR only — returns 400 for SEXTING_SETS
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });
    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }
    const orgId = user.currentOrganizationId;

    // Permission check
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id, organizationId: orgId },
      select: { role: true },
    });
    if (!canManageQueue((membership?.role ?? null) as OrgRole | null)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const { action, reason, qaNotes, campaignOrUnlock, totalSale } = body as {
      action: 'approve' | 'reject_caption' | 'reject_flyer' | 'reject_both';
      reason?: string;
      qaNotes?: string;
      campaignOrUnlock?: string;
      totalSale?: number;
    };

    if (!action || !['approve', 'reject_caption', 'reject_flyer', 'reject_both'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve", "reject_caption", "reject_flyer", or "reject_both"' },
        { status: 400 },
      );
    }

    // Fetch the board item with workspace templateType
    const item = await prisma.boardItem.findUnique({
      where: { id },
      include: {
        column: {
          select: {
            id: true,
            name: true,
            boardId: true,
            board: {
              select: {
                workspace: {
                  select: { templateType: true },
                },
              },
            },
          },
        },
      },
    });

    if (!item || item.organizationId !== orgId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const boardId = item.column.boardId;
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    const workflowType = item.column.board.workspace.templateType;
    const isSextingSets = workflowType === 'SEXTING_SETS';

    // Block flyer-related actions for sexting sets
    if (isSextingSets && (action === 'reject_flyer' || action === 'reject_both')) {
      return NextResponse.json(
        { error: 'Flyer rejection is not available for sexting sets' },
        { status: 400 },
      );
    }

    // Find target column based on workflow type and action
    let targetColumnName: string;
    switch (action) {
      case 'approve':
        targetColumnName = isSextingSets ? 'Review' : 'For Approval';
        break;
      case 'reject_caption':
      case 'reject_both':
        targetColumnName = isSextingSets ? 'Needs Captioning' : 'PGT Team';
        break;
      case 'reject_flyer':
        targetColumnName = 'Flyer Team';
        break;
    }

    const targetColumn = await prisma.boardColumn.findFirst({
      where: {
        boardId,
        name: { equals: targetColumnName, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });

    if (!targetColumn) {
      return NextResponse.json(
        { error: `Target column "${targetColumnName}" not found` },
        { status: 404 },
      );
    }

    const now = new Date();

    // Build metadata updates
    const metaUpdates: Record<string, unknown> = {
      ...meta,
      _updatedAt: now.toISOString(),
    };

    // Save QA metadata if provided
    if (qaNotes !== undefined) metaUpdates.qaNotes = qaNotes;
    if (!isSextingSets) {
      if (campaignOrUnlock !== undefined) metaUpdates.campaignOrUnlock = campaignOrUnlock;
      if (totalSale !== undefined) metaUpdates.totalSale = totalSale;
    }

    if (action === 'approve') {
      metaUpdates.qaApprovedAt = now.toISOString();
      metaUpdates.qaApprovedBy = clerkId;
      metaUpdates.qaRejectionReason = null;
      if (isSextingSets) {
        metaUpdates.sextingSetStatus = SEXTING_SET_STATUS.QA_APPROVED;
      } else {
        metaUpdates.qaFlyerRejectionReason = null;
        metaUpdates.otpPtrCaptionStatus = OTP_PTR_CAPTION_STATUS.APPROVED;
      }
    } else if (action === 'reject_caption' || action === 'reject_both') {
      metaUpdates.qaRejectionReason = reason;
      if (isSextingSets) {
        metaUpdates.sextingSetStatus = SEXTING_SET_STATUS.REVISION_REQUIRED;
        metaUpdates.captionStatus = 'in_revision';
      } else {
        metaUpdates.otpPtrCaptionStatus = OTP_PTR_CAPTION_STATUS.NEEDS_REVISION;
        metaUpdates.captionStatus = 'in_revision';
        if (action === 'reject_both') {
          metaUpdates.qaFlyerRejectionReason = reason;
        }
      }
    } else if (action === 'reject_flyer') {
      metaUpdates.qaFlyerRejectionReason = reason;
    }

    // Execute in transaction
    const updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.boardItem.update({
        where: { id },
        data: {
          columnId: targetColumn.id,
          metadata: metaUpdates as any,
          updatedAt: now,
        },
        include: {
          column: {
            select: { id: true, name: true },
          },
        },
      });

      // Record history
      await tx.boardItemHistory.create({
        data: {
          itemId: id,
          action: 'updated',
          field: 'columnId',
          oldValue: item.column.name,
          newValue: targetColumn.name,
          userId: user.id,
        },
      });

      if (action !== 'approve') {
        await tx.boardItemHistory.create({
          data: {
            itemId: id,
            action: 'updated',
            field: `metadata.qaAction`,
            oldValue: null,
            newValue: `QA ${action}: ${reason}`,
            userId: user.id,
          },
        });
      }

      // If rejecting caption, also update the linked CaptionQueueTicket
      if ((action === 'reject_caption' || action === 'reject_both') && typeof meta.captionTicketId === 'string') {
        await tx.captionQueueTicket.update({
          where: { id: meta.captionTicketId as string },
          data: {
            status: 'in_revision',
            qaRejectionReason: reason,
            completedAt: null,
            updatedAt: now,
          },
        }).catch(() => {
          // Ticket may not exist if it was deleted — non-critical
        });
      }

      // If approving, also mark the linked CaptionQueueTicket as completed
      if (action === 'approve' && typeof meta.captionTicketId === 'string') {
        await tx.captionQueueTicket.update({
          where: { id: meta.captionTicketId as string },
          data: {
            status: 'completed',
            qaRejectionReason: null,
            completedAt: now,
            updatedAt: now,
          },
        }).catch(() => {
          // Ticket may not exist — non-critical
        });
      }

      return updated;
    });

    // Broadcast real-time update
    try {
      await broadcastToBoard(boardId, id);
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      item: updatedItem,
      action,
      targetColumn: targetColumn.name,
    });
  } catch (error) {
    console.error('[QA Review PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
