import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import {
  canCreateQueue,
  canViewQueue,
  isCreatorRole,
  type OrgRole,
} from '@/lib/rbac';
import { broadcastToOrg } from '@/lib/ably-server';

// Shared include for ticket + assignees + content items
const TICKET_INCLUDE = {
  assignees: {
    select: { clerkId: true },
  },
  contentItems: {
    orderBy: { sortOrder: 'asc' as const },
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
} as const;

/**
 * Resolve the current user's db record + org membership in one round-trip.
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

// ---------------------------------------------------------------------------
// GET /api/caption-queue
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Must be in an org and have at least VIEW rights
    if (!ctx.organizationId || !canViewQueue(ctx.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let whereClause: Record<string, unknown>;

    const CLAIM_TTL_MS = 30 * 60 * 1000; // 30 minutes — must match claim/route.ts
    const expiredBefore = new Date(Date.now() - CLAIM_TTL_MS);

    if (isCreatorRole(ctx.role)) {
      // CREATORs see three buckets:
      //  1. Explicitly assigned to them
      //  2. Unassigned + unclaimed (or claim expired) — the "available pool"
      //  3. Their own active claims
      whereClause = {
        organizationId: ctx.organizationId,
        OR: [
          // Bucket 1: explicitly assigned
          { assignees: { some: { clerkId } } },
          // Bucket 2: available pool — no assignees AND no active claim from anyone else
          {
            assignees: { none: {} },
            OR: [
              { claimedBy: null },
              { claimedAt: { lt: expiredBefore } },
            ],
          },
          // Bucket 3: claimed by this creator
          { claimedBy: clerkId },
        ],
      };
    } else {
      // OWNER / ADMIN / MANAGER see all org tickets
      whereClause = { organizationId: ctx.organizationId };
    }

    const rawItems = await prisma.captionQueueTicket.findMany({
      where: whereClause,
      include: TICKET_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Apply this user's personal sort order when available
    const userOrder = await prisma.captionQueueUserOrder.findFirst({
      where: { clerkId, orgId: ctx.organizationId },
      select: { ticketIds: true },
    });

    let items = rawItems;
    if (userOrder && userOrder.ticketIds.length > 0) {
      const orderMap = new Map(userOrder.ticketIds.map((id, i) => [id, i]));
      const urgencyPriority: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
      items = [...rawItems].sort((a, b) => {
        const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
        const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
        if (aIdx !== bIdx) return aIdx - bIdx;
        // New tickets (not yet in the user's saved order) fall to the end, sorted by urgency then date
        const uDiff = (urgencyPriority[b.urgency] || 0) - (urgencyPriority[a.urgency] || 0);
        if (uDiff !== 0) return uDiff;
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
      });
    }

    // Batch-fetch board item metadata to surface the QA rejection reason on each ticket
    const boardItemIds = items.map(i => i.boardItemId).filter(Boolean) as string[];
    const boardItemMeta = boardItemIds.length > 0
      ? await prisma.boardItem.findMany({
          where: { id: { in: boardItemIds } },
          select: { id: true, metadata: true },
        })
      : [];
    const boardMetaMap = new Map(
      boardItemMeta.map(b => [b.id, (b.metadata ?? {}) as Record<string, unknown>])
    );

    // Batch-fetch display info for any active claimers so managers/admins can see who's working on a ticket
    const claimedBySet = [...new Set(items.map(i => i.claimedBy).filter(Boolean) as string[])];
    const claimerUsers = claimedBySet.length > 0
      ? await prisma.user.findMany({
          where: { clerkId: { in: claimedBySet } },
          select: { clerkId: true, firstName: true, lastName: true, imageUrl: true },
        })
      : [];
    const claimerMap = new Map(claimerUsers.map(u => [u.clerkId, u]));

    const enrichedItems = items.map(item => ({
      ...item,
      // Prefer the board-item metadata value (most up-to-date after QA actions);
      // fall back to the ticket's own DB column so the reason is never lost.
      qaRejectionReason: item.boardItemId
        ? ((boardMetaMap.get(item.boardItemId)?.qaRejectionReason as string | null)
            ?? item.qaRejectionReason
            ?? null)
        : (item.qaRejectionReason ?? null),
      claimedByUser: item.claimedBy
        ? (claimerMap.get(item.claimedBy) ?? null)
        : null,
    }));

    return NextResponse.json({ items: enrichedItems });
  } catch (error) {
    console.error('Error fetching caption queue:', error);
    return NextResponse.json({ error: 'Failed to fetch queue items' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/caption-queue
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveUserContext(clerkId);
    if (!ctx) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only OWNER / ADMIN / MANAGER can create queue items
    if (!ctx.organizationId || !canCreateQueue(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owners, Admins, and Managers can create queue items' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      modelName,
      modelAvatar,
      profileImageUrl,
      description,
      contentTypes,
      messageTypes,
      urgency,
      releaseDate,
      profileId,
      contentUrl,
      contentSourceType,
      originalFileName,
      boardItemId,
      assignedCreatorClerkIds = [] as string[],
      contentItems = [] as Array<{
        url: string;
        sourceType: string;
        fileName?: string | null;
        fileType?: string | null;
        sortOrder?: number;
      }>,
    } = body;

    // Validate required fields
    if (!modelName || !modelAvatar || !description || !contentTypes || !messageTypes || !releaseDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!Array.isArray(contentTypes) || contentTypes.length === 0) {
      return NextResponse.json({ error: 'At least one content type is required' }, { status: 400 });
    }
    if (!Array.isArray(messageTypes) || messageTypes.length === 0) {
      return NextResponse.json({ error: 'At least one message type is required' }, { status: 400 });
    }

    // Validate assignees are CREATOR-role members of the same org
    if ((assignedCreatorClerkIds as string[]).length > 0) {
      const assigneeUsers = await prisma.user.findMany({
        where: { clerkId: { in: assignedCreatorClerkIds } },
        select: { id: true },
      });

      const validCreatorCount = await prisma.teamMember.count({
        where: {
          organizationId: ctx.organizationId,
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

    // Create ticket + assignees in a transaction
    const item = await prisma.$transaction(async (tx) => {
      const ticket = await tx.captionQueueTicket.create({
        data: {
          clerkId,
          organizationId: ctx.organizationId!,
          profileId: profileId ?? null,
          modelName,
          modelAvatar: (modelAvatar as string).toUpperCase(),
          profileImageUrl: profileImageUrl ?? null,
          description,
          contentTypes,
          messageTypes,
          urgency: urgency ?? 'medium',
          releaseDate: new Date(releaseDate),
          status: 'pending',
          contentUrl: contentUrl ?? null,
          contentSourceType: contentSourceType ?? null,
          originalFileName: originalFileName ?? null,
          boardItemId: boardItemId ?? null,
        },
      });

      if ((assignedCreatorClerkIds as string[]).length > 0) {
        await tx.captionQueueAssignee.createMany({
          data: (assignedCreatorClerkIds as string[]).map((cId: string) => ({
            ticketId: ticket.id,
            clerkId: cId,
          })),
        });
      }

      // Create content items
      if ((contentItems as typeof contentItems).length > 0) {
        await tx.captionQueueContentItem.createMany({
          data: (contentItems as Array<{ url: string; sourceType: string; fileName?: string | null; fileType?: string | null; sortOrder?: number }>).map((item, i) => ({
            ticketId: ticket.id,
            url: item.url,
            sourceType: item.sourceType,
            fileName: item.fileName ?? null,
            fileType: item.fileType ?? null,
            sortOrder: item.sortOrder ?? i,
          })),
        });
      }

      return tx.captionQueueTicket.findUnique({
        where: { id: ticket.id },
        include: { assignees: { select: { clerkId: true } } },
      });
    });

    // Push real-time notification to every Ably subscriber watching this org.
    // Works across serverless invocations — Ably.Rest uses plain HTTP to publish.
    if (item && ctx.organizationId) {
      await broadcastToOrg(ctx.organizationId, {
        type: 'NEW_TICKET',
        ticketId: item.id,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        assignedCreatorClerkIds: item.assignees.map((a) => a.clerkId),
      });
    }

    // Write caption ticket reference back to the linked board item so the
    // wall-post modal can display status without an extra join.
    if (item && boardItemId) {
      try {
        const existing = await prisma.boardItem.findUnique({
          where: { id: boardItemId },
          select: { metadata: true },
        });
        const prev = (existing?.metadata as Record<string, unknown>) ?? {};
        await prisma.boardItem.update({
          where: { id: boardItemId },
          data: {
            metadata: {
              ...prev,
              captionTicketId: item.id,
              captionStatus: 'pending',
              captionText: null,
              wallPostStatus: 'IN_CAPTION',
            },
            updatedAt: new Date(),
          },
        });
      } catch (e) {
        // Non-fatal — log but don't fail the response
        console.error('Failed to write captionTicketId back to board item:', e);
      }
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating queue item:', error);
    return NextResponse.json({ error: 'Failed to create queue item' }, { status: 500 });
  }
}
