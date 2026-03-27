import { prisma } from '@/lib/database';
import { broadcastToOrg, broadcastToBoard } from '@/lib/ably-server';
import { SEXTING_SET_STATUS } from '@/lib/sexting-set-status';

/**
 * Auto-push a SEXTING_SETS board item to Caption Workspace.
 *
 * Called server-side when a board item is moved to the "Needs Captioning" column.
 * Mirrors the logic from `POST /api/caption-queue/from-board-item` but without
 * HTTP request/response overhead.
 *
 * This is non-fatal — errors are logged but do not propagate.
 */
export async function autoPushSextingSetToCaption(params: {
  boardItemId: string;
  clerkId: string;
  organizationId: string;
}): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  const { boardItemId, clerkId, organizationId } = params;

  try {
    // 1. Fetch board item + metadata
    const boardItem = await prisma.boardItem.findUnique({
      where: { id: boardItemId },
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        organizationId: true,
        column: {
          select: {
            boardId: true,
            board: { select: { workspace: { select: { templateType: true } } } },
          },
        },
      },
    });

    if (!boardItem) return { success: false, error: 'Board item not found' };

    // 2. Prevent duplicate push
    const metadata = (boardItem.metadata as Record<string, unknown>) ?? {};
    if (metadata.captionTicketId) {
      const existing = await prisma.captionQueueTicket.findUnique({
        where: { id: metadata.captionTicketId as string },
        select: { id: true },
      });
      if (existing) return { success: false, error: 'Already has an active caption ticket' };
    }

    // 3. Fetch media
    const media = await prisma.boardItemMedia.findMany({
      where: { itemId: boardItemId },
      orderBy: { createdAt: 'asc' },
    });

    if (media.length === 0) return { success: false, error: 'No media to caption' };

    // 4. Resolve model info
    let profileId: string | null =
      (metadata.profileId as string) || (metadata.modelId as string) || null;
    let modelName = (metadata.model as string) || boardItem.title || 'Unknown Model';
    let modelAvatar = modelName.substring(0, 2).toUpperCase();
    let profileImageUrl = (metadata.profileImageUrl as string) || null;

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
    } else if (modelName && modelName !== 'Unknown Model') {
      const profileByName = await prisma.instagramProfile.findFirst({
        where: { name: { equals: modelName, mode: 'insensitive' }, organizationId },
        select: { id: true, name: true, profileImageUrl: true },
      });
      if (profileByName) {
        profileId = profileByName.id;
        modelName = profileByName.name;
        modelAvatar = profileByName.name.substring(0, 2).toUpperCase();
        profileImageUrl = profileByName.profileImageUrl || profileImageUrl;
      }
    }

    const description =
      (metadata.description as string) ||
      boardItem.description ||
      `Sexting Set caption for ${modelName}`;

    const contentTypes = [
      ...new Set(
        metadata.contentTypes
          ? (metadata.contentTypes as string[])
          : (media.map((m) => m.type).filter(Boolean) as string[]),
      ),
    ];

    // 5. Transaction: create ticket + content items + update board item
    const ticket = await prisma.$transaction(async (tx) => {
      const newTicket = await tx.captionQueueTicket.create({
        data: {
          clerkId,
          organizationId,
          profileId,
          modelName,
          modelAvatar,
          profileImageUrl,
          description,
          contentTypes: contentTypes.length > 0 ? contentTypes : ['image'],
          messageTypes: ['sexting_sets'],
          urgency: 'medium',
          releaseDate: new Date(),
          status: 'pending',
          boardItemId,
          workflowType: 'sexting_sets',
        },
      });

      await tx.captionQueueContentItem.createMany({
        data: media.map((m, i) => {
          const mimePrefix = m.type?.split('/')[0];
          const isDriveFile =
            m.url.includes('drive.google.com') ||
            m.url.includes('lh3.googleusercontent.com/d/');
          return {
            ticketId: newTicket.id,
            url: m.url,
            sourceType: isDriveFile ? 'gdrive' : 'upload',
            fileName: m.name || null,
            fileType:
              mimePrefix === 'image' || mimePrefix === 'video' ? mimePrefix : null,
            sortOrder: i,
            requiresCaption: true,
            captionStatus: 'pending',
          };
        }),
      });

      await tx.boardItem.update({
        where: { id: boardItemId },
        data: {
          metadata: {
            ...metadata,
            captionTicketId: newTicket.id,
            captionStatus: 'pending',
            sextingSetStatus: SEXTING_SET_STATUS.IN_CAPTION,
          },
          updatedAt: new Date(),
        },
      });

      return newTicket;
    });

    // 6. Broadcasts (non-fatal)
    try {
      await broadcastToOrg(organizationId, {
        type: 'NEW_TICKET',
        ticketId: ticket.id,
        orgId: organizationId,
        senderClerkId: clerkId,
        assignedCreatorClerkIds: [],
      });

      const boardId = boardItem.column?.boardId;
      if (boardId) {
        await broadcastToBoard(boardId, boardItemId);
      }
    } catch {
      // Non-fatal
    }

    return { success: true, ticketId: ticket.id };
  } catch (e) {
    console.error('[sexting-sets-auto-caption] Failed to auto-push:', e);
    return { success: false, error: String(e) };
  }
}
