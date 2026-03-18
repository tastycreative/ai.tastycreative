import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, canQAInSpace, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import {
  OTP_PTR_CAPTION_STATUS,
} from '@/lib/otp-ptr-caption-status';

/**
 * PATCH /api/caption-queue/[id]/qa/otp-ptr
 *
 * Approve or reject a single-caption OTP/PTR caption ticket.
 *
 * Body:
 *   action: 'approve' | 'reject'
 *   reason?: string  (required when action is 'reject')
 *
 * Approve:
 *   - ticket.status = 'completed'
 *   - ticket.completedAt = now
 *   - boardItem.metadata.otpPtrCaptionStatus = 'APPROVED'
 *   - boardItem.metadata.captionStatus = 'completed'
 *
 * Reject:
 *   - ticket.status = 'in_revision'
 *   - ticket.qaRejectionReason = reason
 *   - boardItem.metadata.otpPtrCaptionStatus = 'NEEDS_REVISION'
 *   - boardItem.metadata.captionStatus = 'in_revision'
 *   - boardItem.metadata.qaRejectionReason = reason
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
    const { action, reason } = body as {
      action: 'approve' | 'reject' | 'revoke_approval';
      reason?: string;
    };

    if (!action || !['approve', 'reject', 'revoke_approval'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve", "reject", or "revoke_approval"' },
        { status: 400 },
      );
    }

    // ── Fetch ticket ──────────────────────────────────────────────────
    const ticket = await prisma.captionQueueTicket.findUnique({
      where: { id },
      include: {
        assignees: { select: { clerkId: true } },
        contentItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Caption ticket not found' },
        { status: 404 },
      );
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

    if (ticket.workflowType !== 'otp_ptr') {
      return NextResponse.json(
        { error: 'This endpoint is only for OTP/PTR tickets' },
        { status: 400 },
      );
    }

    // Must be in a reviewable state
    if (action === 'revoke_approval') {
      // revoke_approval is only valid when the ticket is completed (approved)
      if (ticket.status !== 'completed') {
        return NextResponse.json(
          { error: `Ticket is in status "${ticket.status}" — only completed (approved) tickets can be revoked` },
          { status: 409 },
        );
      }
    } else if (!['pending_qa', 'in_revision', 'in_progress', 'pending'].includes(ticket.status)) {
      return NextResponse.json(
        {
          error: `Ticket is in status "${ticket.status}" and cannot be reviewed at this time`,
        },
        { status: 409 },
      );
    }

    // ── Execute action ────────────────────────────────────────────────
    const now = new Date();

    const updatedTicket = await prisma.$transaction(async (tx) => {
      let updated: typeof ticket;

      if (action === 'approve') {
        updated = await tx.captionQueueTicket.update({
          where: { id },
          data: {
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          },
          include: {
            assignees: { select: { clerkId: true } },
            contentItems: { orderBy: { sortOrder: 'asc' } },
          },
        });
      } else if (action === 'reject') {
        updated = await tx.captionQueueTicket.update({
          where: { id },
          data: {
            status: 'in_revision',
            qaRejectionReason: reason,
            updatedAt: now,
            completedAt: null,
          },
          include: {
            assignees: { select: { clerkId: true } },
            contentItems: { orderBy: { sortOrder: 'asc' } },
          },
        });
      } else {
        // revoke_approval — send back to pending QA
        updated = await tx.captionQueueTicket.update({
          where: { id },
          data: {
            status: 'pending_qa',
            completedAt: null,
            qaRejectionReason: null,
            updatedAt: now,
          },
          include: {
            assignees: { select: { clerkId: true } },
            contentItems: { orderBy: { sortOrder: 'asc' } },
          },
        });
      }

      // Sync back to board item
      if (ticket.boardItemId) {
        const existingItem = await tx.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: { metadata: true, column: { select: { boardId: true } } },
        });
        const prevMeta =
          (existingItem?.metadata as Record<string, unknown>) ?? {};

        const newMeta: Record<string, unknown> =
          action === 'approve'
            ? {
                ...prevMeta,
                otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.APPROVED,
                captionStatus: 'completed',
                // Preserve the caption text that was approved
                captionText: ticket.captionText ?? (prevMeta.captionText as string) ?? null,
              }
            : action === 'reject'
            ? {
                ...prevMeta,
                otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.NEEDS_REVISION,
                captionStatus: 'in_revision',
                qaRejectionReason: reason,
              }
            : {
                // revoke_approval
                ...prevMeta,
                otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.AWAITING_APPROVAL,
                captionStatus: 'pending_qa',
                qaRejectionReason: null,
              };

        await tx.boardItem.update({
          where: { id: ticket.boardItemId },
          data: { metadata: newMeta as any, updatedAt: now },
        });
      }

      return updated;
    });

    // ── Real-time broadcasts ──────────────────────────────────────────
    if (ctx.organizationId) {
      await broadcastToOrg(ctx.organizationId, {
        type: 'TICKET_QA_ACTION',
        ticketId: id,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        action,
        status: updatedTicket.status,
      });
    }

    // Notify board subscribers
    if (ticket.boardItemId) {
      const boardItem = await prisma.boardItem.findUnique({
        where: { id: ticket.boardItemId },
        select: { column: { select: { boardId: true } } },
      });
      if (boardItem?.column?.boardId) {
        await broadcastToBoard(boardItem.column.boardId, ticket.boardItemId);
      }
    }

    const otpPtrCaptionStatus =
      action === 'approve'
        ? OTP_PTR_CAPTION_STATUS.APPROVED
        : action === 'reject'
        ? OTP_PTR_CAPTION_STATUS.NEEDS_REVISION
        : OTP_PTR_CAPTION_STATUS.AWAITING_APPROVAL;

    return NextResponse.json(
      {
        item: updatedTicket,
        action,
        otpPtrCaptionStatus,
        reason: action === 'reject' ? reason : undefined,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error processing OTP/PTR QA action:', error);
    return NextResponse.json(
      { error: 'Failed to process QA action' },
      { status: 500 },
    );
  }
}
