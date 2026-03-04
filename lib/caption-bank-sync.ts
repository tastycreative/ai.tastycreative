/**
 * Caption Bank Sync — Automatically saves captions to the Caption Bank
 * when content is marked as "Posted" from Wall Post or OTP/PTR boards.
 *
 * Uses unique constraints on sourceContentItemId / sourceTicketId to prevent
 * duplicate entries. All operations are idempotent and production-safe.
 */

import { prisma } from '@/lib/database';

interface SaveCaptionToBankInput {
  /** The caption text to save */
  captionText: string;
  /** Instagram profile ID (influencer) to associate the caption with */
  profileId: string;
  /** Clerk user ID who triggered the save */
  clerkId: string;
  /** The influencer/model display name */
  modelName: string;
  /** Source workflow type */
  sourceType: 'wall_post' | 'otp_ptr';
  /** The board item ID this caption originated from */
  sourceBoardItemId: string | null;
  /** For wall_post: the CaptionQueueContentItem ID (unique per item) */
  sourceContentItemId?: string | null;
  /** For otp_ptr: the CaptionQueueTicket ID (unique per ticket) */
  sourceTicketId?: string | null;
}

/**
 * Saves a caption to the Caption Bank (captions table) when content is posted.
 *
 * Deduplication: Uses unique constraints on sourceContentItemId (wall post)
 * and sourceTicketId (OTP/PTR) to prevent double-inserts.
 *
 * Returns the created/existing caption record, or null if the caption was
 * empty or the profile doesn't exist.
 */
export async function saveCaptionToBank(
  input: SaveCaptionToBankInput,
): Promise<{ id: string; caption: string; profileId: string } | null> {
  const {
    captionText,
    profileId,
    clerkId,
    modelName,
    sourceType,
    sourceBoardItemId,
    sourceContentItemId,
    sourceTicketId,
  } = input;

  // Guard: don't save empty captions
  if (!captionText?.trim()) {
    return null;
  }

  // Guard: ensure the profile exists
  const profile = await prisma.instagramProfile.findUnique({
    where: { id: profileId },
    select: { id: true, name: true },
  });

  if (!profile) {
    console.warn(
      `[caption-bank-sync] Profile ${profileId} not found, skipping caption save`,
    );
    return null;
  }

  try {
    // Check for existing entry using unique source identifiers
    if (sourceContentItemId) {
      const existing = await prisma.caption.findUnique({
        where: { sourceContentItemId },
        select: { id: true, caption: true, profileId: true },
      });
      if (existing) {
        return existing;
      }
    }

    if (sourceTicketId) {
      const existing = await prisma.caption.findUnique({
        where: { sourceTicketId },
        select: { id: true, caption: true, profileId: true },
      });
      if (existing) {
        return existing;
      }
    }

    // Create the caption bank entry
    const newCaption = await prisma.caption.create({
      data: {
        clerkId,
        profileId,
        caption: captionText.trim(),
        captionCategory: 'auto',
        captionTypes: 'posted',
        captionBanks: 'model',
        originalModelName: modelName || profile.name,
        sourceType,
        sourceBoardItemId,
        sourceContentItemId: sourceContentItemId ?? null,
        sourceTicketId: sourceTicketId ?? null,
        notes: `Auto-saved from ${sourceType === 'wall_post' ? 'Wall Post' : 'OTP/PTR'} board`,
      },
      select: { id: true, caption: true, profileId: true },
    });

    console.log(
      `[caption-bank-sync] Saved caption to bank: ${newCaption.id} for profile ${profileId} (${sourceType})`,
    );

    return newCaption;
  } catch (error: unknown) {
    // Handle unique constraint violations gracefully (race conditions)
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      console.log(
        `[caption-bank-sync] Caption already exists (race condition), skipping`,
      );
      return null;
    }

    console.error('[caption-bank-sync] Error saving caption to bank:', error);
    return null;
  }
}

/**
 * Saves a caption from a Wall Post content item when it's marked as "Posted".
 *
 * Called from: PATCH /api/caption-queue/items/[itemId] when isPosted=true
 */
export async function saveCaptionFromWallPost(params: {
  contentItemId: string;
  /** Caption text from the DB record — may be null; boardItemCaptionText is the fallback */
  captionText: string | null;
  /** Caption text from the board item metadata captionItems array — used as fallback */
  boardItemCaptionText?: string | null;
  ticket: {
    id: string;
    profileId: string | null;
    modelName: string;
    boardItemId: string | null;
    organizationId: string | null;
  };
  clerkId: string;
}): Promise<void> {
  const { contentItemId, captionText, boardItemCaptionText, ticket, clerkId } = params;

  // Resolve caption text: prefer DB record, fall back to board metadata
  const resolvedCaption = captionText?.trim() || boardItemCaptionText?.trim() || null;

  if (!resolvedCaption) {
    return;
  }

  // Resolve profileId: use ticket's profileId, or fall back to name-based lookup
  let profileId = ticket.profileId;

  if (!profileId && ticket.modelName && ticket.organizationId) {
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        name: { equals: ticket.modelName, mode: 'insensitive' },
        organizationId: ticket.organizationId,
      },
      select: { id: true },
    });
    if (profile) {
      profileId = profile.id;
    }
  }

  if (!profileId) {
    console.warn(
      `[caption-bank-sync] No profile found for wall post ticket ${ticket.id} (model: "${ticket.modelName}"), skipping caption save`,
    );
    return;
  }

  await saveCaptionToBank({
    captionText: resolvedCaption,
    profileId,
    clerkId,
    modelName: ticket.modelName,
    sourceType: 'wall_post',
    sourceBoardItemId: ticket.boardItemId,
    sourceContentItemId: contentItemId,
  });
}

/**
 * Saves a caption from an OTP/PTR board item when it's moved to "Posted" column.
 *
 * Called from: PATCH /api/spaces/:spaceId/boards/:boardId/items/:itemId
 * when the new column name is "Posted" (case-insensitive).
 */
export async function saveCaptionFromOtpPtr(params: {
  boardItemId: string;
  metadata: Record<string, unknown>;
  clerkId: string;
}): Promise<void> {
  const { boardItemId, metadata, clerkId } = params;

  // Extract caption text — try captionText first (from Caption Workspace),
  // then fall back to the caption field (manually entered)
  const captionText =
    (metadata.captionText as string) || (metadata.caption as string) || '';

  if (!captionText?.trim()) {
    return;
  }

  // Resolve profile ID: check metadata for profileId/modelId, or look up by model name
  let profileId: string | null =
    (metadata.profileId as string) ||
    (metadata.modelId as string) ||
    null;

  const modelName = (metadata.model as string) || '';

  // If no profile ID in metadata, try to find by name within the same org
  if (!profileId && modelName) {
    const boardItem = await prisma.boardItem.findUnique({
      where: { id: boardItemId },
      select: { organizationId: true },
    });

    if (boardItem?.organizationId) {
      const profile = await prisma.instagramProfile.findFirst({
        where: {
          name: { equals: modelName, mode: 'insensitive' },
          organizationId: boardItem.organizationId,
        },
        select: { id: true },
      });
      if (profile) {
        profileId = profile.id;
      }
    }
  }

  if (!profileId) {
    console.warn(
      `[caption-bank-sync] No profile found for OTP/PTR board item ${boardItemId}, skipping`,
    );
    return;
  }

  // Use the captionTicketId for dedup if it exists, otherwise use boardItemId-based key
  const ticketId = (metadata.captionTicketId as string) || null;

  await saveCaptionToBank({
    captionText,
    profileId,
    clerkId,
    modelName,
    sourceType: 'otp_ptr',
    sourceBoardItemId: boardItemId,
    sourceTicketId: ticketId,
  });
}
