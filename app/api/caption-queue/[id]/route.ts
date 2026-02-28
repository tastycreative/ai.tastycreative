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

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error('Error updating queue item:', error);
    return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
  }
}