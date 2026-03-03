import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';
import {
  OTP_PTR_CAPTION_STATUS,
  parseDriveLink,
} from '@/lib/otp-ptr-caption-status';

type Params = { params: Promise<{ spaceId: string; boardId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId/boards/:boardId/items                     */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { boardId } = await params;

    // Fetch the board's columns so we know the board exists
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: { orderBy: { position: 'asc' } },
      },
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Fetch all items across all columns of this board
    const items = await prisma.boardItem.findMany({
      where: { columnId: { in: board.columns.map((c) => c.id) } },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { comments: true, media: true } },
      },
    });

    return NextResponse.json({
      columns: board.columns.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        position: c.position,
      })),
      items: items.map((item) => ({
        id: item.id,
        organizationId: item.organizationId,
        itemNo: item.itemNo,
        columnId: item.columnId,
        title: item.title,
        description: item.description,
        type: item.type,
        priority: item.priority,
        assigneeId: item.assigneeId,
        dueDate: item.dueDate?.toISOString() ?? null,
        position: item.position,
        metadata: item.metadata,
        createdBy: item.createdBy,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        _count: item._count,
      })),
    });
  } catch (error) {
    console.error('Error fetching board items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/boards/:boardId/items                    */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId, boardId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    if (!body.columnId) {
      return NextResponse.json({ error: 'columnId is required.' }, { status: 400 });
    }

    // Get the workspace to retrieve organizationId and template type
    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true, templateType: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get the next itemNo for this organization
    const maxItem = await prisma.boardItem.findFirst({
      where: { organizationId: workspace.organizationId },
      orderBy: { itemNo: 'desc' },
      select: { itemNo: true },
    });

    const nextItemNo = (maxItem?.itemNo ?? 0) + 1;

    const item = await prisma.boardItem.create({
      data: {
        organizationId: workspace.organizationId,
        itemNo: nextItemNo,
        columnId: body.columnId,
        title: body.title.trim(),
        description: body.description?.trim() ?? null,
        type: body.type ?? 'TASK',
        priority: body.priority ?? 'MEDIUM',
        position: 0,
        metadata: body.metadata ?? null,
        assigneeId: body.assigneeId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        createdBy: userId,
      },
    });

    // Record creation in history
    await prisma.boardItemHistory.create({
      data: {
        itemId: item.id,
        userId,
        action: 'CREATED',
        field: 'item',
        newValue: item.title,
      },
    });

    const senderTab = req.headers.get('x-tab-id') ?? undefined;
    try {
      publishBoardEvent(boardId, 'item.created', { userId, entityId: item.id, tabId: senderTab });
    } catch (_) {
      // Ably not configured — skip real-time notification
    }

    // ── Auto-push to Caption Workspace for OTP_PTR boards ─────────────
    // When the space template is OTP_PTR, automatically create a
    // CaptionQueueTicket so the ticket appears in the Caption Workspace
    // as soon as the board item is created.
    let finalMetadata = item.metadata as Record<string, unknown> | null;

    if (workspace.templateType === 'OTP_PTR') {
      try {
        // Always use the workspace's org — don't rely on user.currentOrganizationId
        const orgId = workspace.organizationId;

        // Auto-push always happens for OTP_PTR boards regardless of role.
        // (canCreateQueue is only enforced for manual pushes via the board modal.)
        if (orgId) {
          const meta = (item.metadata as Record<string, unknown>) ?? {};
          const driveLink = (meta.driveLink as string) ?? '';
          const parsedDrive = driveLink ? parseDriveLink(driveLink) : null;

          // Resolve profile / model info
          let profileId: string | null =
            (meta.profileId as string) || (meta.modelId as string) || null;
          let modelName =
            (meta.model as string) || item.title || 'Unknown Model';
          let modelAvatar = modelName.substring(0, 2).toUpperCase();
          let profileImageUrl = (meta.profileImageUrl as string) || null;

          if (profileId) {
            const profile = await prisma.instagramProfile.findUnique({
              where: { id: profileId },
              select: { name: true, profileImageUrl: true },
            });
            if (profile) {
              modelName = profile.name || modelName;
              modelAvatar = modelName.substring(0, 2).toUpperCase();
              profileImageUrl = profile.profileImageUrl || profileImageUrl;
            }
          }

          if (!profileId && modelName !== 'Unknown Model' && orgId) {
            const profileByName = await prisma.instagramProfile.findFirst({
              where: {
                name: { equals: modelName, mode: 'insensitive' },
                organizationId: orgId,
              },
              select: { id: true, name: true, profileImageUrl: true },
            });
            if (profileByName) {
              profileId = profileByName.id;
              modelName = profileByName.name;
              modelAvatar = profileByName.name.substring(0, 2).toUpperCase();
              profileImageUrl =
                profileByName.profileImageUrl || profileImageUrl;
            }
          }

          const newTicket = await prisma.$transaction(async (tx) => {
            const created = await tx.captionQueueTicket.create({
              data: {
                clerkId: userId,
                organizationId: orgId,
                profileId,
                modelName,
                modelAvatar,
                profileImageUrl,
                description:
                  (meta.description as string) ||
                  item.description ||
                  `OTP/PTR caption for ${modelName}`,
                contentTypes: (meta.contentType as string)
                  ? [(meta.contentType as string)]
                  : ['content'],
                messageTypes: ['otp_ptr'],
                urgency: 'medium',
                releaseDate: new Date(),
                status: 'pending',
                boardItemId: item.id,
                workflowType: 'otp_ptr',
                contentUrl: driveLink || null,
                contentSourceType: parsedDrive ? 'gdrive' : null,
              },
            });

            // Create display-only drive link content item
            if (driveLink) {
              await tx.captionQueueContentItem.create({
                data: {
                  ticketId: created.id,
                  url: driveLink,
                  sourceType: 'gdrive',
                  fileName: parsedDrive
                    ? parsedDrive.type === 'folder'
                      ? 'Google Drive Folder'
                      : 'Google Drive File'
                    : 'Google Drive Link',
                  fileType: null,
                  sortOrder: 0,
                  requiresCaption: false,
                  captionStatus: 'not_required',
                },
              });
            }

            // Update board item metadata with caption ticket link
            const updatedMeta: Record<string, unknown> = {
              ...(meta as Record<string, unknown>),
              captionTicketId: created.id,
              captionStatus: 'pending',
              otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.IN_CAPTION,
            };

            await tx.boardItem.update({
              where: { id: item.id },
              data: {
                metadata: updatedMeta as any,
                updatedAt: new Date(),
              },
            });

            return created;
          });

          // Reload updated metadata for the response
          const updatedItem = await prisma.boardItem.findUnique({
            where: { id: item.id },
            select: { metadata: true },
          });
          finalMetadata = updatedItem?.metadata as Record<string, unknown> | null;

          // Real-time broadcast so the Caption Workspace panel refreshes
          try {
            const { broadcastToOrg } = await import('@/lib/ably-server');
            await broadcastToOrg(orgId, {
              type: 'NEW_TICKET',
              ticketId: newTicket.id,
              orgId,
              senderClerkId: userId,
              assignedCreatorClerkIds: [],
              workflowType: 'otp_ptr',
            });
            publishBoardEvent(boardId, 'item.updated', {
              userId,
              entityId: item.id,
              tabId: senderTab,
            });
          } catch (_) {
            // Non-fatal
          }
        }
      } catch (autoPushErr) {
        // Auto-push is non-fatal — board item is already created.
        console.error(
          'OTP/PTR auto-push to caption queue failed (non-fatal):',
          autoPushErr,
        );
      }
    }

    return NextResponse.json(
      {
        id: item.id,
        organizationId: item.organizationId,
        itemNo: item.itemNo,
        columnId: item.columnId,
        title: item.title,
        description: item.description,
        type: item.type,
        priority: item.priority,
        assigneeId: item.assigneeId,
        dueDate: item.dueDate?.toISOString() ?? null,
        position: item.position,
        metadata: finalMetadata ?? item.metadata,
        createdBy: item.createdBy,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating board item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
