import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canCreateQueue, type OrgRole } from '@/lib/rbac';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import { WALL_POST_STATUS } from '@/lib/wall-post-status';

/**
 * POST /api/caption-queue/from-board-item
 *
 * Atomically pushes a wall-post board item to the Caption Workspace.
 *
 * Body:
 *   boardItemId         – required, the BoardItem to push
 *   assignedCreatorClerkIds – optional string[], creators to assign
 *   urgency             – optional, defaults to 'medium'
 *   releaseDate         – optional, defaults to now
 *   description         – optional, falls back to board item title
 *
 * This endpoint:
 *  1. Validates the board item exists and belongs to the same org
 *  2. Prevents duplicate pushes (if a ticket already linked)
 *  3. Fetches the board item's media to create contentItems
 *  4. Creates a CaptionQueueTicket in a transaction
 *  5. Updates BoardItem.metadata with wallPostStatus=IN_CAPTION + captionTicketId
 *  6. Broadcasts real-time events
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

    // Only OWNER / ADMIN / MANAGER can push to caption workspace
    if (!ctx.organizationId || !canCreateQueue(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only Owners, Admins, and Managers can push to Caption Workspace' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      boardItemId,
      assignedCreatorClerkIds = [] as string[],
      urgency = 'medium',
      releaseDate,
      description: bodyDescription,
    } = body;

    if (!boardItemId) {
      return NextResponse.json({ error: 'boardItemId is required' }, { status: 400 });
    }

    // ── Fetch board item with its column for board ID ──
    const boardItem = await prisma.boardItem.findUnique({
      where: { id: boardItemId },
      include: {
        column: {
          select: { boardId: true },
        },
      },
    });

    if (!boardItem) {
      return NextResponse.json({ error: 'Board item not found' }, { status: 404 });
    }

    // Must belong to the same org
    if (boardItem.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Prevent duplicate push ──
    const metadata = (boardItem.metadata as Record<string, unknown>) ?? {};
    if (metadata.captionTicketId) {
      // Check if the referenced ticket still exists (not deleted)
      const existingTicket = await prisma.captionQueueTicket.findUnique({
        where: { id: metadata.captionTicketId as string },
        select: { id: true, status: true },
      });
      if (existingTicket) {
        return NextResponse.json(
          {
            error: 'This wall post already has an active caption ticket',
            ticketId: existingTicket.id,
            ticketStatus: existingTicket.status,
          },
          { status: 409 },
        );
      }
      // Ticket was deleted — allow re-push
    }

    // ── Fetch media for this board item ──
    const media = await prisma.boardItemMedia.findMany({
      where: { itemId: boardItemId },
      orderBy: { createdAt: 'asc' },
    });

    if (media.length === 0) {
      return NextResponse.json(
        { error: 'Board item has no media to caption' },
        { status: 400 },
      );
    }

    // ── Validate assignees ──
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

    // ── Extract model info from board item metadata ──
    // Content submissions store the Instagram profile ID as `modelId`
    let profileId: string | null = (metadata.profileId as string) || (metadata.modelId as string) || null;

    // When we have a profileId, fetch the actual profile for accurate model info
    let resolvedModelName = (metadata.model as string) || boardItem.title || 'Unknown Model';
    let resolvedAvatar = ((metadata.modelAvatar as string) || resolvedModelName).toUpperCase();
    let resolvedImageUrl = (metadata.profileImageUrl as string) || null;

    if (profileId) {
      const profile = await prisma.instagramProfile.findUnique({
        where: { id: profileId },
        select: { name: true, profileImageUrl: true },
      });
      if (profile) {
        resolvedModelName = profile.name || resolvedModelName;
        resolvedAvatar = resolvedModelName.substring(0, 2).toUpperCase();
        resolvedImageUrl = profile.profileImageUrl || resolvedImageUrl;
      }
    }

    // Fallback: if still no profileId, try to find the profile by name within the org
    if (!profileId && resolvedModelName && resolvedModelName !== 'Unknown Model' && ctx.organizationId) {
      const profileByName = await prisma.instagramProfile.findFirst({
        where: {
          name: { equals: resolvedModelName, mode: 'insensitive' },
          organizationId: ctx.organizationId,
        },
        select: { id: true, name: true, profileImageUrl: true },
      });
      if (profileByName) {
        profileId = profileByName.id;
        resolvedModelName = profileByName.name;
        resolvedAvatar = profileByName.name.substring(0, 2).toUpperCase();
        resolvedImageUrl = profileByName.profileImageUrl || resolvedImageUrl;
      }
    }

    const modelName = resolvedModelName;
    const modelAvatar = resolvedAvatar;
    const profileImageUrl = resolvedImageUrl;
    const description =
      bodyDescription ||
      (metadata.description as string) ||
      boardItem.description ||
      `Wall Post caption for ${modelName}`;

    // Derive contentTypes and messageTypes from metadata or defaults — deduplicate to avoid React key warnings
    const contentTypes = [...new Set(
      metadata.contentTypes
        ? (metadata.contentTypes as string[])
        : media.map((m) => m.type).filter(Boolean) as string[]
    )];
    const messageTypes = [...new Set(
      metadata.messageTypes
        ? (metadata.messageTypes as string[])
        : ['wall_post']
    )];

    // ── Atomic transaction: create ticket + link board item ──
    const ticket = await prisma.$transaction(async (tx) => {
      // 1. Create the caption queue ticket
      const newTicket = await tx.captionQueueTicket.create({
        data: {
          clerkId,
          organizationId: ctx.organizationId!,
          profileId,
          modelName,
          modelAvatar,
          profileImageUrl,
          description,
          contentTypes: contentTypes.length > 0 ? contentTypes : ['image'],
          messageTypes: messageTypes.length > 0 ? messageTypes : ['wall_post'],
          urgency,
          releaseDate: releaseDate ? new Date(releaseDate) : new Date(),
          status: 'pending',
          boardItemId,
        },
      });

      // 2. Create assignees
      if ((assignedCreatorClerkIds as string[]).length > 0) {
        await tx.captionQueueAssignee.createMany({
          data: (assignedCreatorClerkIds as string[]).map((cId: string) => ({
            ticketId: newTicket.id,
            clerkId: cId,
          })),
        });
      }

      // 3. Create content items from media
      //    BoardItemMedia.type is a MIME type (e.g. 'image/png', 'video/mp4').
      //    ContentItemData expects sourceType = 'upload'|'gdrive' and
      //    fileType = 'image'|'video'|null, so we derive them properly.
      //    requiresCaptionOverrides allows marking specific media as not needing captions.
      const requiresCaptionOverrides = (body.requiresCaptionOverrides ?? {}) as Record<string, boolean>;
      await tx.captionQueueContentItem.createMany({
        data: media.map((m, i) => {
          const mimePrefix = m.type?.split('/')[0]; // 'image', 'video', etc.
          // Detect Google Drive URLs for proper rendering in caption workspace
          const isDriveFile = m.url.includes('drive.google.com') || m.url.includes('lh3.googleusercontent.com/d/');
          // Check overrides by media ID or index
          const needsCaption = requiresCaptionOverrides[m.id] ?? requiresCaptionOverrides[String(i)] ?? true;
          return {
            ticketId: newTicket.id,
            url: m.url,
            sourceType: isDriveFile ? 'gdrive' : 'upload',
            fileName: m.name || null,
            fileType: mimePrefix === 'image' || mimePrefix === 'video' ? mimePrefix : null,
            sortOrder: i,
            requiresCaption: needsCaption,
            captionStatus: needsCaption ? 'pending' : 'not_required',
          };
        }),
      });

      // 4. Update board item metadata with status + ticket link
      const prevMeta = (boardItem.metadata as Record<string, unknown>) ?? {};
      await tx.boardItem.update({
        where: { id: boardItemId },
        data: {
          metadata: {
            ...prevMeta,
            captionTicketId: newTicket.id,
            captionStatus: 'pending',
            wallPostStatus: WALL_POST_STATUS.IN_CAPTION,
          },
          updatedAt: new Date(),
        },
      });

      // Return the full ticket with relations
      return tx.captionQueueTicket.findUnique({
        where: { id: newTicket.id },
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
              revisionCount: true,
            },
          },
        },
      });
    });

    // ── Real-time broadcasts ──
    if (ticket && ctx.organizationId) {
      // Notify caption queue subscribers
      await broadcastToOrg(ctx.organizationId, {
        type: 'NEW_TICKET',
        ticketId: ticket.id,
        orgId: ctx.organizationId,
        senderClerkId: clerkId,
        assignedCreatorClerkIds: ticket.assignees.map((a) => a.clerkId),
      });

      // Notify board subscribers so UI updates the item status
      const boardId = boardItem.column?.boardId;
      if (boardId) {
        await broadcastToBoard(boardId, boardItemId);
      }
    }

    return NextResponse.json(
      {
        item: ticket,
        boardItemId,
        wallPostStatus: WALL_POST_STATUS.IN_CAPTION,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error pushing board item to caption queue:', error);
    return NextResponse.json(
      { error: 'Failed to push to Caption Workspace' },
      { status: 500 },
    );
  }
}
