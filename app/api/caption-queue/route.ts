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

    if (isCreatorRole(ctx.role)) {
      // CREATORs only see tickets explicitly assigned to them
      whereClause = {
        organizationId: ctx.organizationId,
        assignees: { some: { clerkId } },
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

    return NextResponse.json({ items });
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

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating queue item:', error);
    return NextResponse.json({ error: 'Failed to create queue item' }, { status: 500 });
  }
}
