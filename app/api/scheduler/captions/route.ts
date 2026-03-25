import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * GET /api/scheduler/captions
 *
 * Returns captions from TWO sources for a given profile:
 * 1. Board Tickets (CaptionQueueTicket) — workspace captions with paired GIFs
 * 2. Caption Bank (Caption table) — master caption bank per profile
 *
 * Each result has a `source` field: 'ticket' or 'bank'
 *
 * Query params:
 *  - profileId (required): Instagram profile ID
 *  - search: text search in caption text
 *  - source: 'all' (default) | 'ticket' | 'bank'
 *  - origin: filter by workflowType/sourceType (e.g. 'otp_ptr', 'wall_post')
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });
    if (!user?.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');
    const search = searchParams.get('search');
    const sourceFilter = searchParams.get('source') || 'all'; // 'all' | 'ticket' | 'bank'
    const originFilter = searchParams.get('origin'); // 'otp_ptr' | 'wall_post' | null

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    const results: SchedulerCaptionResult[] = [];

    // ── Source 1: Board Tickets (CaptionQueueTicket) ──
    if (sourceFilter === 'all' || sourceFilter === 'ticket') {
      const ticketWhere: Record<string, unknown> = {
        profileId,
        organizationId: user.currentOrganizationId,
        captionText: { not: null },
      };
      if (search) {
        ticketWhere.captionText = { contains: search, mode: 'insensitive', not: null };
      }
      if (originFilter) {
        ticketWhere.workflowType = originFilter;
      }

      const tickets = await prisma.captionQueueTicket.findMany({
        where: ticketWhere,
        select: {
          id: true,
          captionText: true,
          status: true,
          workflowType: true,
          contentTypes: true,
          profileId: true,
          boardItemId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      // Fetch linked board items
      const boardItemIds = tickets
        .map((t) => t.boardItemId)
        .filter((id): id is string => !!id);

      const boardItems = boardItemIds.length > 0
        ? await prisma.boardItem.findMany({
            where: { id: { in: boardItemIds } },
            select: { id: true, title: true, metadata: true },
          })
        : [];

      const boardItemMap = new Map(boardItems.map((b) => [b.id, b]));

      for (const t of tickets) {
        if (!t.captionText?.trim()) continue;
        const boardItem = t.boardItemId ? boardItemMap.get(t.boardItemId) : null;
        const meta = (boardItem?.metadata || {}) as Record<string, unknown>;

        results.push({
          id: t.id,
          caption: t.captionText!,
          source: 'ticket',
          origin: t.workflowType || 'general',
          profileId: t.profileId || '',
          status: t.status,
          contentTypes: t.contentTypes || [],
          createdAt: t.createdAt.toISOString(),
          boardItemId: t.boardItemId || null,
          gifUrl: (meta.gifUrl as string) || '',
          gifUrlFansly: (meta.gifUrlFansly as string) || '',
          contentCount: (meta.contentCount as string) || '',
          contentLength: (meta.contentLength as string) || '',
          contentType: (meta.contentType as string) || '',
          price: meta.price as number ?? 0,
          driveLink: (meta.driveLink as string) || '',
          boardTitle: boardItem?.title || '',
        });
      }
    }

    // ── Source 2: Caption Bank (Caption table) ──
    if (sourceFilter === 'all' || sourceFilter === 'bank') {
      const bankWhere: Record<string, unknown> = { profileId };
      if (search) {
        bankWhere.caption = { contains: search, mode: 'insensitive' };
      }
      if (originFilter) {
        bankWhere.sourceType = originFilter;
      }

      const bankCaptions = await prisma.caption.findMany({
        where: bankWhere,
        select: {
          id: true,
          caption: true,
          captionCategory: true,
          captionTypes: true,
          usageCount: true,
          isFavorite: true,
          sourceType: true,
          totalRevenue: true,
          createdAt: true,
        },
        orderBy: [{ isFavorite: 'desc' }, { usageCount: 'desc' }],
        take: 50,
      });

      for (const c of bankCaptions) {
        if (!c.caption?.trim()) continue;
        results.push({
          id: `bank_${c.id}`,
          caption: c.caption,
          source: 'bank',
          origin: c.sourceType || 'manual',
          profileId,
          status: 'active',
          contentTypes: [],
          createdAt: c.createdAt.toISOString(),
          boardItemId: null,
          gifUrl: '',
          gifUrlFansly: '',
          contentCount: '',
          contentLength: '',
          contentType: c.captionCategory || '',
          price: 0,
          driveLink: '',
          boardTitle: '',
          usageCount: c.usageCount,
          isFavorite: c.isFavorite,
          totalRevenue: Number(c.totalRevenue) || 0,
        });
      }

      // Also fetch from gallery_items.captionUsed (the "Caption Vault / The Bank" source)
      const galleryWhere: Record<string, unknown> = {
        profileId,
        captionUsed: { not: null },
        isArchived: false,
      };
      if (search) {
        galleryWhere.captionUsed = { contains: search, mode: 'insensitive', not: null };
      }
      if (originFilter) {
        galleryWhere.postOrigin = originFilter.toUpperCase(); // e.g., 'PPV', 'WALL_POST'
      }

      const galleryItems = await prisma.gallery_items.findMany({
        where: galleryWhere,
        select: {
          id: true,
          captionUsed: true,
          contentType: true,
          postOrigin: true,
          pricingAmount: true,
          postedAt: true,
          boardMetadata: true,
          revenue: true,
        },
        orderBy: { postedAt: 'desc' },
        take: 50,
      });

      // Deduplicate: skip gallery items whose caption already exists from tickets
      const existingCaptionTexts = new Set(results.map((r) => r.caption.trim().slice(0, 100)));

      for (const g of galleryItems) {
        if (!g.captionUsed?.trim()) continue;
        const snippet = g.captionUsed.trim().slice(0, 100);
        if (existingCaptionTexts.has(snippet)) continue;
        existingCaptionTexts.add(snippet);

        const meta = (g.boardMetadata || {}) as Record<string, unknown>;
        results.push({
          id: `gallery_${g.id}`,
          caption: g.captionUsed,
          source: 'bank',
          origin: (g.postOrigin || 'posted').toLowerCase(),
          profileId,
          status: 'posted',
          contentTypes: g.contentType ? [g.contentType] : [],
          createdAt: g.postedAt?.toISOString() || '',
          boardItemId: null,
          gifUrl: (meta.gifUrl as string) || '',
          gifUrlFansly: (meta.gifUrlFansly as string) || '',
          contentCount: (meta.contentCount as string) || '',
          contentLength: (meta.contentLength as string) || '',
          contentType: g.contentType || '',
          price: Number(g.pricingAmount) || 0,
          driveLink: (meta.driveLink as string) || '',
          boardTitle: '',
          totalRevenue: Number(g.revenue) || 0,
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching scheduler captions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch captions' },
      { status: 500 },
    );
  }
}

interface SchedulerCaptionResult {
  id: string;
  caption: string;
  source: 'ticket' | 'bank';
  origin: string;
  profileId: string;
  status: string;
  contentTypes: string[];
  createdAt: string;
  boardItemId: string | null;
  gifUrl: string;
  gifUrlFansly: string;
  contentCount: string;
  contentLength: string;
  contentType: string;
  price: number;
  driveLink: string;
  boardTitle: string;
  usageCount?: number;
  isFavorite?: boolean;
  totalRevenue?: number;
}
