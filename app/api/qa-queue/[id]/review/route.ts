import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, type OrgRole } from '@/lib/rbac';
import { broadcastToBoard } from '@/lib/ably-server';
import { OTP_PTR_CAPTION_STATUS } from '@/lib/otp-ptr-caption-status';

/**
 * PATCH /api/qa-queue/[id]/review
 *
 * QA review action for an OTP/PTR board item.
 *
 * Body:
 *   action: 'approve' | 'reject_caption' | 'reject_flyer' | 'reject_both'
 *   reason?: string   (optional rejection reason)
 *   qaNotes?: string  (optional QA notes)
 *   campaignOrUnlock?: string
 *   totalSale?: number
 *
 * approve:
 *   - moves item to "For Approval" column
 *   - saves QA metadata (notes, campaign/unlock, total sale)
 *
 * reject_caption:
 *   - moves item back to "PGT Team" column
 *   - sets otpPtrCaptionStatus = NEEDS_REVISION
 *   - updates linked caption ticket status
 *
 * reject_flyer:
 *   - moves item back to "Flyer Team" column
 *   - stores flyer rejection reason
 *
 * reject_both:
 *   - moves item back to "PGT Team" column
 *   - sets both caption and flyer rejection reasons
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

    // Fetch the board item
    const item = await prisma.boardItem.findUnique({
      where: { id },
      include: {
        column: {
          select: {
            id: true,
            name: true,
            boardId: true,
          },
        },
      },
    });

    if (!item || item.organizationId !== orgId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const boardId = item.column.boardId;
    const meta = (item.metadata ?? {}) as Record<string, unknown>;

    // Find target column
    let targetColumnName: string;
    switch (action) {
      case 'approve':
        targetColumnName = 'For Approval';
        break;
      case 'reject_caption':
      case 'reject_both':
        targetColumnName = 'PGT Team';
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
    if (campaignOrUnlock !== undefined) metaUpdates.campaignOrUnlock = campaignOrUnlock;
    if (totalSale !== undefined) metaUpdates.totalSale = totalSale;

    if (action === 'approve') {
      metaUpdates.qaApprovedAt = now.toISOString();
      metaUpdates.qaApprovedBy = clerkId;
      metaUpdates.qaFlyerRejectionReason = null;
      metaUpdates.otpPtrCaptionStatus = OTP_PTR_CAPTION_STATUS.APPROVED;
      metaUpdates.qaRejectionReason = null;
    } else if (action === 'reject_caption' || action === 'reject_both') {
      metaUpdates.otpPtrCaptionStatus = OTP_PTR_CAPTION_STATUS.NEEDS_REVISION;
      metaUpdates.captionStatus = 'in_revision';
      metaUpdates.qaRejectionReason = reason;
      if (action === 'reject_both') {
        metaUpdates.qaFlyerRejectionReason = reason;
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
