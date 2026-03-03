import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, canViewQueue, isCreatorRole, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import { captionStatusToWallPostStatus } from '@/lib/wall-post-status';
import { captionStatusToOtpPtrStatus } from '@/lib/otp-ptr-caption-status';

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

type CaptionItemSync = {
  contentItemId: string;
  url: string;
  fileName: string | null;
  captionText: string | null;
  captionStatus: string;
  qaRejectionReason: string | null;
};

/** Sync caption result back to a linked board item's metadata (non-fatal). */
async function syncCaptionToBoardItem(
  boardItemId: string | null | undefined,
  captionText: string | null | undefined,
  status: string | null | undefined,
  ticketId?: string,
  captionItems?: CaptionItemSync[],
  workflowType?: string | null,
) {
  if (!boardItemId) return;
  try {
    // When submitting for QA without a direct captionText, build it from content items
    let resolvedCaptionText = captionText;
    if (resolvedCaptionText === undefined && status === 'pending_qa' && ticketId) {
      const items = await prisma.captionQueueContentItem.findMany({
        where: { ticketId },
        orderBy: { sortOrder: 'asc' },
        select: { captionText: true },
      });
      if (items.length > 0) {
        const combined = items
          .map((ci, idx) =>
            items.length > 1
              ? `[${idx + 1}] ${ci.captionText ?? ''}`
              : (ci.captionText ?? ''),
          )
          .filter(Boolean)
          .join('\n\n');
        resolvedCaptionText = combined.trim() || null;
      }
    }

    const existing = await prisma.boardItem.findUnique({
      where: { id: boardItemId },
      select: { metadata: true, column: { select: { boardId: true } } },
    });
    const prev = (existing?.metadata as Record<string, unknown>) ?? {};

    // Determine the effective workflowType — prefer the passed arg, fall back to what's already in metadata
    const effectiveWorkflowType =
      workflowType ?? (prev.captionTicketId ? null : null);

    const updatedMeta: Record<string, unknown> = {
      ...prev,
      ...(resolvedCaptionText !== undefined ? { captionText: resolvedCaptionText } : {}),
      // Map ticket status → a readable captionStatus on the board item
      ...(status !== undefined ? {
        captionStatus: status === 'completed' ? 'completed'
          : status === 'pending_qa' ? 'pending_qa'
          : status,
      } : {}),
      // For wall_post workflow: sync wallPostStatus
      ...(status !== undefined && effectiveWorkflowType !== 'otp_ptr' ? (() => {
        const wps = captionStatusToWallPostStatus(status ?? '');
        return wps ? { wallPostStatus: wps } : {};
      })() : {}),
      // For otp_ptr workflow: sync otpPtrCaptionStatus
      ...(status !== undefined && effectiveWorkflowType === 'otp_ptr' ? (() => {
        const ops = captionStatusToOtpPtrStatus(status ?? '');
        return ops ? { otpPtrCaptionStatus: ops } : {};
      })() : {}),
      // Sync per-item caption statuses when provided
      ...(captionItems !== undefined ? { captionItems } : {}),
    };
    await prisma.boardItem.update({
      where: { id: boardItemId },
      data: {
        metadata: updatedMeta as any,
        updatedAt: new Date(),
      },
    });

    // Notify the board page so it invalidates its cache
    if (existing?.column?.boardId) {
      await broadcastToBoard(existing.column.boardId, boardItemId);
    }
  } catch (e) {
    console.error('Failed to sync caption back to board item:', e);
  }
}

/** Fetch all content items for a ticket in the board-metadata sync format. */
async function fetchCaptionItemsForSync(ticketId: string): Promise<CaptionItemSync[]> {
  const items = await prisma.captionQueueContentItem.findMany({
    where: { ticketId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      url: true,
      fileName: true,
      captionText: true,
      captionStatus: true,
      qaRejectionReason: true,
    },
  });
  return items.map((ci) => ({
    contentItemId: ci.id,
    url: ci.url,
    fileName: ci.fileName ?? null,
    captionText: ci.captionText ?? null,
    captionStatus: ci.captionStatus,
    qaRejectionReason: ci.qaRejectionReason ?? null,
  }));
}

// DELETE /api/caption-queue/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;

    const item = await prisma.captionQueueTicket.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Must be in the same org AND be a manager+, OR be the original creator
    const sameOrg = item.organizationId && item.organizationId === ctx.organizationId;
    const isOwnerOfTicket = item.clerkId === clerkId;

    if (!((sameOrg && canManageQueue(ctx.role)) || isOwnerOfTicket)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.captionQueueTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting queue item:', error);
    return NextResponse.json({ error: 'Failed to delete queue item' }, { status: 500 });
  }
}

// PATCH /api/caption-queue/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;

    const item = await prisma.captionQueueTicket.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const sameOrg = item.organizationId && item.organizationId === ctx.organizationId;

    // Managers+ can edit any field; CREATORs can only update status/captionText on their assigned tickets
    if (sameOrg && canManageQueue(ctx.role)) {
      // full edit allowed
    } else if (sameOrg && isCreatorRole(ctx.role)) {
      // Verify this creator is assigned to the ticket
      const assignee = await prisma.captionQueueAssignee.findFirst({
        where: { ticketId: id, clerkId },
      });
      if (!assignee) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (item.clerkId === clerkId) {
      // ticket creator can edit their own
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    // Prevent overwriting protected fields; extract assignees separately
    const { clerkId: _c, organizationId: _o, assignees: _a, assignedCreatorClerkIds, ...safeBody } = body;

    // When a creator submits for QA, promote all in_progress items → submitted
    // so the QA modal can show per-item approve/reject controls.
    if (safeBody.status === 'pending_qa') {
      await prisma.captionQueueContentItem.updateMany({
        where: { ticketId: id, captionStatus: 'in_progress' },
        data: { captionStatus: 'submitted', updatedAt: new Date() },
      });
    }

    // Pre-fetch updated captionItems for board metadata sync when submitting for QA
    const syncCaptionItems = safeBody.status === 'pending_qa'
      ? await fetchCaptionItemsForSync(id)
      : undefined;

    // Validate assignees if provided
    if (Array.isArray(assignedCreatorClerkIds)) {
      if (assignedCreatorClerkIds.length > 0) {
        const assigneeUsers = await prisma.user.findMany({
          where: { clerkId: { in: assignedCreatorClerkIds } },
          select: { id: true },
        });

        const validCreatorCount = await prisma.teamMember.count({
          where: {
            organizationId: item.organizationId!,
            role: 'CREATOR',
            userId: { in: assigneeUsers.map((u) => u.id) },
          },
        });

        if (validCreatorCount !== assigneeUsers.length) {
          return NextResponse.json(
            { error: 'One or more assignees are not CREATOR-role members of this organization' },
            { status: 400 },
          );
        }
      }

      // Update assignees + ticket fields in one transaction
      const updatedItem = await prisma.$transaction(async (tx) => {
        await tx.captionQueueAssignee.deleteMany({ where: { ticketId: id } });

        if ((assignedCreatorClerkIds as string[]).length > 0) {
          await tx.captionQueueAssignee.createMany({
            data: (assignedCreatorClerkIds as string[]).map((cId: string) => ({
              ticketId: id,
              clerkId: cId,
            })),
          });
        }

        return tx.captionQueueTicket.update({
          where: { id },
          data: { ...safeBody, updatedAt: new Date() },
          include: { assignees: { select: { clerkId: true } } },
        });
      });

    // Notify all org members watching the queue
      if (updatedItem?.organizationId) {
        await broadcastToOrg(updatedItem.organizationId, {
          type: 'TICKET_UPDATED',
          ticketId: id,
          orgId: updatedItem.organizationId,
          senderClerkId: clerkId,
          captionText: updatedItem?.captionText ?? null,
          status: updatedItem?.status ?? null,
        });
      }

      await syncCaptionToBoardItem(
        item.boardItemId,
        'captionText' in safeBody ? (safeBody.captionText as string | null) : undefined,
        'status' in safeBody ? (safeBody.status as string | null) : undefined,
        id,
        syncCaptionItems,
        item.workflowType,
      );

      return NextResponse.json({ item: updatedItem });
    }

    const updatedItem = await prisma.captionQueueTicket.update({
      where: { id },
      data: { ...safeBody, updatedAt: new Date() },
      include: {
        assignees: { select: { clerkId: true } },
        contentItems: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, sourceType: true, fileName: true, fileType: true, sortOrder: true, captionText: true } },
      },
    });

    // Notify all org members watching the queue
    if (updatedItem.organizationId) {
      await broadcastToOrg(updatedItem.organizationId, {
        type: 'TICKET_UPDATED',
        ticketId: id,
        orgId: updatedItem.organizationId,
        senderClerkId: clerkId,
        captionText: updatedItem.captionText ?? null,
        status: updatedItem.status ?? null,
      });
    }

    await syncCaptionToBoardItem(
      item.boardItemId,
      'captionText' in safeBody ? (safeBody.captionText as string | null) : undefined,
      'status' in safeBody ? (safeBody.status as string | null) : undefined,
      id,
      syncCaptionItems,
      item.workflowType,
    );

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error('Error updating queue item:', error);
    return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
  }
}