import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { Prisma } from '@/lib/generated/prisma';
import { publishBoardEvent } from '@/lib/ably';
import { saveCaptionFromWallPost } from '@/lib/caption-bank-sync';
import { resolveDriveThumbnail, getCategoryPlaceholder } from '@/lib/google-drive-thumbnail';

type Params = {
  params: Promise<{ spaceId: string; boardId: string; itemId: string }>;
};

/* ── Helpers ─────────────────────────────────────────────── */

interface CaptionItemMeta {
  contentItemId?: string;
  url?: string;
  fileName?: string | null;
  captionText?: string | null;
  captionStatus?: string | null;
  isPosted?: boolean;
}

/**
 * Detect whether a board item belongs to a Wall Post board.
 * Only `wallPostStatus` is exclusively set on Wall Post tickets.
 * `captionItems` is NOT a reliable discriminator — OTP/PTR tickets can also
 * have caption arrays in their metadata. The primary check is templateType.
 */
function isWallPostItem(meta: Record<string, unknown>): boolean {
  return meta.wallPostStatus !== undefined;
}

/**
 * Determine gallery-friendly content type from a MIME type string.
 */
function contentTypeFromMime(mime: string | null | undefined): string {
  if (!mime) return 'PHOTO';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('image/gif')) return 'GIF';
  return 'PHOTO';
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/boards/:boardId/items/:itemId/mark-final */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spaceId, boardId, itemId } = await params;

    // 1. Fetch the board item with media and column info
    const item = await prisma.boardItem.findUnique({
      where: { id: itemId },
      include: {
        media: true,
        column: {
          include: {
            board: {
              include: {
                columns: { orderBy: { position: 'asc' } },
                workspace: { select: { templateType: true } },
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 2. Validate item is in a "Ready to Deploy" or "Ready to Post" column
    const currentColumnName = item.column.name.toLowerCase();
    const isValidSourceColumn =
      currentColumnName.includes('ready to deploy') ||
      currentColumnName.includes('ready to post');
    if (!isValidSourceColumn) {
      return NextResponse.json(
        { error: 'Item must be in a "Ready to Deploy" or "Ready to Post" column' },
        { status: 400 },
      );
    }

    // 3. Find the "Posted" column in the same board
    const postedColumn = item.column.board.columns.find(
      (c) => c.name.toLowerCase() === 'posted',
    );

    if (!postedColumn) {
      return NextResponse.json(
        { error: 'No "Posted" column found in this board' },
        { status: 400 },
      );
    }

    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    const isWallPost =
      item.column.board.workspace?.templateType === 'WALL_POST' ||
      isWallPostItem(meta);

    /* ═══════════════════════════════════════════════════════ */
    /*  Wall Post flow: one gallery item per ticket (carousel) */
    /* ═══════════════════════════════════════════════════════ */

    if (isWallPost) {
      // 4a. Dedup: one gallery item per board item
      const existingWallPostGallery = await prisma.gallery_items.findFirst({
        where: { boardItemId: itemId },
      });
      if (existingWallPostGallery) {
        return NextResponse.json(
          { error: 'This item has already been marked as final' },
          { status: 409 },
        );
      }

      // 5a. Resolve profile & model IDs
      let profileId: string | null =
        (meta.profileId as string) || (meta.modelId as string) || null;
      if (profileId) {
        const profileExists = await prisma.instagramProfile.findUnique({
          where: { id: profileId },
          select: { id: true },
        });
        if (!profileExists) profileId = null;
      }

      // Platform — Wall Post uses singular `platform`
      const PLATFORM_MAP: Record<string, string> = { onlyfans: 'OF', fansly: 'FANSLY' };
      const rawPlatform = (meta.platform as string) || 'onlyfans';
      const platformStr = PLATFORM_MAP[rawPlatform] || rawPlatform.toUpperCase();

      // Build tags from metadata
      const tags: string[] = ['WALL_POST'];
      if (Array.isArray(meta.hashtags)) {
        tags.push(...(meta.hashtags as string[]));
      }

      // Merge media with caption data
      const captionItems: CaptionItemMeta[] = Array.isArray(meta.captionItems)
        ? (meta.captionItems as CaptionItemMeta[])
        : [];

      // Build per-media entries from BoardItemMedia + matched captions.
      // Only include entries where the matched captionItem has isPosted === true
      // (or where there is no captionItem tracking at all).
      const hasCaptionTracking = captionItems.length > 0;

      const mediaEntries: {
        url: string;
        mimeType: string | null;
        name: string | null;
        captionText: string | null;
        contentItemId: string | null;
      }[] = item.media
        .map((m, idx) => {
          const match =
            captionItems.find((ci) => ci.url === m.url) ??
            captionItems.find((ci) => ci.fileName === m.name) ??
            captionItems[idx] ??
            null;
          return {
            url: m.url,
            mimeType: m.type,
            name: m.name,
            captionText: match?.captionText ?? null,
            contentItemId: match?.contentItemId ?? null,
            // If no captionItem tracking, treat as included
            isPosted: match ? (match.isPosted ?? false) : !hasCaptionTracking,
          };
        })
        .filter((e) => e.isPosted);

      // Fall back to captionItems URLs if no BoardItemMedia — only posted ones
      if (mediaEntries.length === 0 && captionItems.length > 0) {
        for (const ci of captionItems) {
          if (ci.url && ci.isPosted) {
            mediaEntries.push({
              url: ci.url,
              mimeType: null,
              name: ci.fileName ?? null,
              captionText: ci.captionText ?? null,
              contentItemId: ci.contentItemId ?? null,
            });
          }
        }
      }

      // Final fallback: placeholder entry so we always have at least one
      if (mediaEntries.length === 0) {
        mediaEntries.push({
          url: (meta.driveLink as string) || '/placeholder-gallery.png',
          mimeType: null,
          name: null,
          captionText: (meta.caption as string) || null,
          contentItemId: null,
        });
      }

      // Build the carousel mediaItems array for boardMetadata
      const carouselItems = mediaEntries.map((e) => ({
        url: e.url,
        captionText: e.captionText ?? null,
        contentType: contentTypeFromMime(e.mimeType),
        fileName: e.name ?? null,
        contentItemId: e.contentItemId ?? null,
      }));

      const firstEntry = mediaEntries[0];
      const primaryContentType = contentTypeFromMime(firstEntry.mimeType);
      const primaryCaption = mediaEntries.find((e) => e.captionText)?.captionText ?? null;

      const wallPostBoardMetadata = {
        mediaItems: carouselItems,
      } as Record<string, unknown>;
      if (meta.captionTicketId) wallPostBoardMetadata.captionTicketId = meta.captionTicketId;
      if (profileId) wallPostBoardMetadata.profileId = profileId;

      // 6a. Transaction: move to "Posted" + create single gallery item
      const { updatedItem, galleryItem } = await prisma.$transaction(async (tx) => {
        const updated = await tx.boardItem.update({
          where: { id: itemId },
          data: { columnId: postedColumn.id },
        });

        const gallery = await tx.gallery_items.create({
          data: {
            title: item.title,
            contentType: primaryContentType,
            captionUsed: primaryCaption,
            tags,
            previewUrl: firstEntry.url || '/placeholder-gallery.png',
            originalAssetUrl: firstEntry.url || null,
            platform: platformStr,
            postedAt: new Date(),
            origin: 'wall_post',
            boardItemId: item.id,
            organizationId: item.organizationId,
            profileId,
            createdBy: userId,
            postOrigin: 'WALL_POST',
            boardMetadata: wallPostBoardMetadata as unknown as Prisma.InputJsonValue,
          },
          select: { id: true, title: true, contentType: true, platform: true, previewUrl: true },
        });

        return { updatedItem: updated, galleryItem: gallery };
      });

      // 7a. History entry
      await prisma.boardItemHistory.create({
        data: {
          itemId: item.id,
          userId,
          action: 'MOVED',
          field: 'column',
          oldValue: item.column.name,
          newValue: postedColumn.name,
        },
      });

      // 8a. Caption Bank: save each captioned content item
      const captionTicketId = (meta.captionTicketId as string) || null;
      let ticketData: {
        id: string;
        profileId: string | null;
        modelName: string;
        boardItemId: string | null;
        organizationId: string | null;
      } | null = null;

      if (captionTicketId) {
        const ticket = await prisma.captionQueueTicket.findUnique({
          where: { id: captionTicketId },
          select: { id: true, profileId: true, modelName: true, boardItemId: true, organizationId: true },
        });
        if (ticket) ticketData = ticket;
      }

      const fallbackTicket = ticketData ?? {
        id: captionTicketId || itemId,
        profileId,
        modelName: (meta.modelName as string) || '',
        boardItemId: itemId,
        organizationId: item.organizationId,
      };

      // Primary path: save captions from mediaEntries (matched from item.media + captionItems metadata)
      const savedContentItemIds = new Set<string>();
      for (const entry of mediaEntries) {
        if (!entry.captionText?.trim() || !entry.contentItemId) continue;
        try {
          await saveCaptionFromWallPost({
            contentItemId: entry.contentItemId,
            captionText: entry.captionText,
            ticket: fallbackTicket,
            clerkId: userId,
          });
          savedContentItemIds.add(entry.contentItemId);
        } catch (e) {
          console.error('[mark-final] Failed to save wall post caption to bank:', e);
        }
      }

      // Fallback: query CaptionQueueContentItem DB records directly.
      // This catches posted items whose captionText/contentItemId weren't
      // carried through the metadata matching (e.g. Drive files where the
      // URL or filename didn't match between BoardItemMedia and captionItems).
      if (captionTicketId) {
        try {
          const dbContentItems = await prisma.captionQueueContentItem.findMany({
            where: { ticketId: captionTicketId, isPosted: true },
            select: { id: true, captionText: true },
          });
          for (const ci of dbContentItems) {
            if (savedContentItemIds.has(ci.id)) continue;
            if (!ci.captionText?.trim()) continue;
            try {
              await saveCaptionFromWallPost({
                contentItemId: ci.id,
                captionText: ci.captionText,
                ticket: fallbackTicket,
                clerkId: userId,
              });
            } catch (e) {
              console.error('[mark-final] Failed to save caption from DB fallback:', e);
            }
          }
        } catch (e) {
          console.error('[mark-final] Failed to query caption queue content items:', e);
        }
      }

      // Publish realtime event
      const senderTab = req.headers.get('x-tab-id') ?? undefined;
      try {
        publishBoardEvent(boardId, 'item.updated', {
          userId,
          entityId: item.id,
          tabId: senderTab,
        });
      } catch (_) {
        // Ably not configured
      }

      return NextResponse.json({
        item: {
          id: updatedItem.id,
          columnId: updatedItem.columnId,
          title: updatedItem.title,
        },
        galleryItem,
        totalGalleryItems: 1,
      });
    }

    /* ═══════════════════════════════════════════════════════ */
    /*  OTP/PTR flow (existing): one gallery item per ticket   */
    /* ═══════════════════════════════════════════════════════ */

    // 4. Check if a gallery item already exists for this board item
    const existingGallery = await prisma.gallery_items.findFirst({
      where: { boardItemId: itemId },
    });

    if (existingGallery) {
      return NextResponse.json(
        { error: 'This item has already been marked as final' },
        { status: 409 },
      );
    }

    // 5. Extract metadata for gallery entry
    const firstMedia = item.media[0];
    let previewUrl =
      firstMedia?.url ||
      (meta.driveLink as string) ||
      '';

    // Build tags from metadata
    const tags: string[] = [];
    if (Array.isArray(meta.contentTags)) {
      tags.push(...(meta.contentTags as string[]));
    }
    if (meta.requestType && typeof meta.requestType === 'string') {
      tags.push(meta.requestType);
    }
    if (meta.contentStyle && typeof meta.contentStyle === 'string') {
      tags.push(meta.contentStyle);
    }

    // Determine content type
    const contentType =
      (meta.contentType as string) ||
      (meta.requestType as string) ||
      'CUSTOM';

    // Determine platform from metadata (array → mapped to gallery constants)
    const PLATFORM_MAP: Record<string, string> = { onlyfans: 'OF', fansly: 'FANSLY' };
    const platforms = Array.isArray(meta.platforms)
      ? (meta.platforms as string[]).map((p: string) => PLATFORM_MAP[p] || p)
      : ['OF'];
    // Use first platform for the primary gallery entry
    const platformStr = platforms[0] || 'OF';

    // Resolve profile ID — meta.modelId is actually an InstagramProfile ID
    // (set by the content submission form which uses Instagram profiles)
    let profileId: string | null =
      (meta.profileId as string) || (meta.modelId as string) || null;
    if (profileId) {
      const profileExists = await prisma.instagramProfile.findUnique({
        where: { id: profileId },
        select: { id: true },
      });
      if (!profileExists) profileId = null;
    }

    // 6. Extract OTP/PTR-specific metadata for gallery
    const postOrigin = (meta.postOrigin as string) ?? (meta.requestType as string) ?? null;
    const pricingTier = (meta.pricingCategory as string) ?? (meta.pricingTier as string) ?? null;
    const pageType = (meta.pageType as string) ?? null;

    const boardMetadata: Record<string, string | string[]> = {};
    if (meta.contentLength) boardMetadata.contentLength = String(meta.contentLength);
    if (meta.contentCount) boardMetadata.contentCount = String(meta.contentCount);
    if (meta.driveLink) boardMetadata.driveLink = String(meta.driveLink);
    if (meta.postLinkOnlyfans) boardMetadata.postLinkOnlyfans = String(meta.postLinkOnlyfans);
    if (meta.postLinkFansly) boardMetadata.postLinkFansly = String(meta.postLinkFansly);
    if (meta.gifUrl) boardMetadata.gifUrl = String(meta.gifUrl);
    if (meta.gifUrlFansly) boardMetadata.gifUrlFansly = String(meta.gifUrlFansly);
    if (meta.captionText) boardMetadata.captionText = String(meta.captionText);
    if (meta.caption) boardMetadata.caption = String(meta.caption);
    if (Array.isArray(meta.internalModelTags) && meta.internalModelTags.length > 0)
      boardMetadata.internalModelTags = meta.internalModelTags as string[];
    if (Array.isArray(meta.externalCreatorTags) && meta.externalCreatorTags.length > 0)
      boardMetadata.externalCreatorTags = meta.externalCreatorTags as string[];
    if (profileId) boardMetadata.profileId = profileId;

    // 6b. Resolve thumbnail for tickets without GIF or media attachments.
    //     If the driveLink is a Google Drive folder, try to pull the first
    //     image/video from it. Otherwise fall back to a category placeholder.
    let resolvedThumbnailUrl: string | null = null;
    let resolvedThumbnailIsGif = false;
    const hasGifOrMedia = !!meta.gifUrl || !!firstMedia;
    if (!hasGifOrMedia && meta.driveLink && typeof meta.driveLink === 'string') {
      try {
        const result = await resolveDriveThumbnail(meta.driveLink as string);
        if (result) {
          resolvedThumbnailUrl = result.url;
          resolvedThumbnailIsGif = result.isGif;
        }
      } catch (e) {
        console.error('[mark-final] Failed to resolve Drive thumbnail:', e);
      }
    }
    if (resolvedThumbnailUrl) {
      boardMetadata.resolvedThumbnailUrl = resolvedThumbnailUrl;
      if (resolvedThumbnailIsGif) boardMetadata.resolvedThumbnailIsGif = 'true';
      // Don't set previewUrl here — the GalleryItem display chain handles
      // resolvedThumbnailUrl via GifThumbnail (with play/pause support).
      // Setting previewUrl would cause the plain <img> branch to match first,
      // bypassing the animated GIF controls.
    } else if (!hasGifOrMedia) {
      // No GIF, no media, no resolvable Drive thumbnail → use category placeholder
      boardMetadata.resolvedThumbnailUrl = getCategoryPlaceholder(postOrigin);
    }

    // Move item to "Posted" column and create gallery entries in a transaction
    const galleryBase = {
      title: item.title,
      contentType,
      pricingAmount: meta.price != null && !isNaN(Number(meta.price)) ? Number(meta.price) : null,
      captionUsed: (meta.captionText as string) || (meta.caption as string) || null,
      tags,
      previewUrl: previewUrl || '/placeholder-gallery.png',
      originalAssetUrl: (meta.driveLink as string) ?? null,
      postedAt: new Date(),
      origin: 'board',
      sourceId: item.id,
      organizationId: item.organizationId,
      profileId,
      createdBy: userId,
      postOrigin,
      pricingTier,
      pageType,
      boardMetadata: Object.keys(boardMetadata).length > 0 ? boardMetadata : undefined,
    };

    const { updatedItem, galleryItem } = await prisma.$transaction(async (tx) => {
      const updated = await tx.boardItem.update({
        where: { id: itemId },
        data: { columnId: postedColumn.id },
      });

      // Primary gallery entry (linked to board item)
      const gallery = await tx.gallery_items.create({
        data: { ...galleryBase, platform: platformStr, boardItemId: item.id },
      });

      // Additional gallery entries for extra platforms
      for (const p of platforms.slice(1)) {
        await tx.gallery_items.create({
          data: { ...galleryBase, platform: p },
        });
      }

      return { updatedItem: updated, galleryItem: gallery };
    });

    // 7. Create history entry for the column move
    await prisma.boardItemHistory.create({
      data: {
        itemId: item.id,
        userId,
        action: 'MOVED',
        field: 'column',
        oldValue: item.column.name,
        newValue: postedColumn.name,
      },
    });

    // Publish realtime event
    const senderTab = req.headers.get('x-tab-id') ?? undefined;
    try {
      publishBoardEvent(boardId, 'item.updated', {
        userId,
        entityId: item.id,
        tabId: senderTab,
      });
    } catch (_) {
      // Ably not configured
    }

    return NextResponse.json({
      item: {
        id: updatedItem.id,
        columnId: updatedItem.columnId,
        title: updatedItem.title,
      },
      galleryItem: {
        id: galleryItem.id,
        title: galleryItem.title,
        contentType: galleryItem.contentType,
        platform: galleryItem.platform,
        previewUrl: galleryItem.previewUrl,
      },
      totalGalleryItems: platforms.length,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error marking item as final:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to mark item as final', details: err.message },
      { status: 500 },
    );
  }
}
