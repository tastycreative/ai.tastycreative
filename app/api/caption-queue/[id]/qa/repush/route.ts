import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import { WALL_POST_STATUS } from '@/lib/wall-post-status';
import { SEXTING_SET_STATUS } from '@/lib/sexting-set-status';

/**
 * POST /api/caption-queue/[id]/qa/repush
 *
 * Re-pushes rejected content items back to the caption workspace.
 * Flips all items with captionStatus='rejected' → 'pending' and
 * transitions the ticket to 'in_revision' / wallPostStatus = IN_REVISION.
 *
 * This is an explicit action by the QA reviewer after finishing
 * per-item approve/reject decisions.
 *
 * Only OWNER / ADMIN / MANAGER can perform this action.
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

export async function POST(
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

    if (!ctx.organizationId || !canManageQueue(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owners, Admins, and Managers can re-push items' },
        { status: 403 },
      );
    }

    const { id: ticketId } = await params;

    // Fetch ticket with content items
    const ticket = await prisma.captionQueueTicket.findUnique({
      where: { id: ticketId },
      include: {
        contentItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow re-push from partially_approved state (has rejected items)
    if (ticket.status !== 'partially_approved') {
      return NextResponse.json(
        { error: `Cannot re-push: ticket status is "${ticket.status}". Must be "partially_approved".` },
        { status: 400 },
      );
    }

    const rejectedItems = ticket.contentItems.filter(
      (ci) => ci.captionStatus === 'rejected',
    );

    if (rejectedItems.length === 0) {
      return NextResponse.json(
        { error: 'No rejected items to re-push' },
        { status: 400 },
      );
    }

    // ── Atomic transaction ──
    const result = await prisma.$transaction(async (tx) => {
      // 1. Flip rejected items → pending so they reappear in captioner's workspace
      await tx.captionQueueContentItem.updateMany({
        where: {
          ticketId,
          captionStatus: 'rejected',
        },
        data: {
          captionStatus: 'pending',
          updatedAt: new Date(),
        },
      });

      // 2. Update ticket status to in_revision
      const updatedTicket = await tx.captionQueueTicket.update({
        where: { id: ticketId },
        data: {
          status: 'in_revision',
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

      // 3. Sync board item metadata
      if (ticket.boardItemId) {
        const boardItem = await tx.boardItem.findUnique({
          where: { id: ticket.boardItemId },
          select: { metadata: true, column: { select: { boardId: true } } },
        });

        if (boardItem) {
          const prevMeta = (boardItem.metadata as Record<string, unknown>) ?? {};

          const captionItems = updatedTicket.contentItems.map((ci) => ({
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
          const inRevisionStatus = isSextingSets ? SEXTING_SET_STATUS.IN_REVISION : WALL_POST_STATUS.IN_REVISION;

          const updatedMeta: Record<string, unknown> = {
            ...prevMeta,
            [statusField]: inRevisionStatus,
            captionStatus: 'in_revision',
            captionItems,
          };

          await tx.boardItem.update({
            where: { id: ticket.boardItemId },
            data: { metadata: updatedMeta as any, updatedAt: new Date() },
          });
        }
      }

      return updatedTicket;
    });

    // ── Real-time broadcasts ──
    if (ctx.organizationId) {
      await broadcastToOrg(ctx.organizationId, {
        type: 'TICKET_UPDATED',
        ticketId,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        status: 'in_revision',
        qaAction: 'repush_rejected',
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

    // Build response captionItems
    const captionItems = result.contentItems.map((ci) => ({
      contentItemId: ci.id,
      url: ci.url,
      fileName: ci.fileName ?? null,
      captionText: ci.captionText ?? null,
      captionStatus: ci.captionStatus,
      qaRejectionReason: ci.qaRejectionReason ?? null,
      isPosted: ci.isPosted,
    }));

    const isSextingSetsTicket = ticket.workflowType === 'sexting_sets';
    const inRevision = isSextingSetsTicket ? SEXTING_SET_STATUS.IN_REVISION : WALL_POST_STATUS.IN_REVISION;

    return NextResponse.json({
      ticket: result,
      wallPostStatus: inRevision,
      ...(isSextingSetsTicket ? { sextingSetStatus: inRevision } : {}),
      ticketStatus: 'in_revision',
      captionItems,
      repushedCount: rejectedItems.length,
    });
  } catch (error) {
    console.error('Error re-pushing rejected items:', error);
    return NextResponse.json(
      { error: 'Failed to re-push rejected items' },
      { status: 500 },
    );
  }
}
