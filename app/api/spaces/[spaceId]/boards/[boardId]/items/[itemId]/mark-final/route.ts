import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';

type Params = {
  params: Promise<{ spaceId: string; boardId: string; itemId: string }>;
};

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
              },
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 2. Validate item is in a "Ready to Deploy"-named column
    const currentColumnName = item.column.name.toLowerCase();
    if (!currentColumnName.includes('ready to deploy')) {
      return NextResponse.json(
        { error: 'Item must be in a "Ready to Deploy" column' },
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
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    const firstMedia = item.media[0];
    const previewUrl =
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

    // Also attempt to resolve of_models ID for backward compatibility
    let modelId: string | null = null;
    if (meta.model && typeof meta.model === 'string') {
      const model = await prisma.of_models.findFirst({
        where: {
          name: { equals: meta.model as string, mode: 'insensitive' },
        },
        select: { id: true },
      });
      modelId = model?.id ?? null;
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
      modelId,
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
