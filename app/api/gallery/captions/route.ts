import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * GET /api/gallery/captions
 *
 * Returns gallery items that have captions, filtered by profileId.
 * Used by the Master Caption Bank and My Influencers Caption Bank
 * to display captions sourced from the gallery.
 *
 * Query params:
 *  - profileId (required): Instagram profile ID, or "all" for all profiles
 *  - search: text search in captionUsed
 *  - contentType: filter by gallery contentType
 *  - postOrigin: filter by postOrigin (OTP, PTR, etc.)
 *  - platform: filter by platform (OF, FANSLY)
 *  - sortBy: postedAt | captionUsed | revenue (default: postedAt)
 *  - sortOrder: asc | desc (default: desc)
 *  - page: page number (default: 1)
 *  - pageSize: items per page (default: 50)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');
    const search = searchParams.get('search');
    const contentType = searchParams.get('contentType');
    const postOrigin = searchParams.get('postOrigin');
    const platform = searchParams.get('platform');
    const sortBy = searchParams.get('sortBy') || 'postedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId is required' },
        { status: 400 },
      );
    }

    // Get current user to determine accessible profiles
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        clerkId: true,
        currentOrganizationId: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine which org the user belongs to, for scoping
    const currentOrgId = dbUser.currentOrganizationId;
    const orgIds = currentOrgId ? [currentOrgId] : [];

    // Build where clause — only gallery items with a non-empty caption
    const where: Record<string, unknown> = {
      AND: [
        { captionUsed: { not: null } },
        { captionUsed: { not: '' } },
      ],
    };

    // Scope to user's organizations
    if (orgIds.length > 0) {
      where.organizationId = { in: orgIds };
    }

    // Profile filter
    if (profileId !== 'all') {
      // Verify user has access to this profile
      const profile = await prisma.instagramProfile.findFirst({
        where: {
          id: profileId,
          OR: [
            { clerkId: userId },
            {
              organizationId: { in: orgIds.length > 0 ? orgIds : ['__none__'] },
            },
          ],
        },
        select: { id: true },
      });

      if (!profile) {
        return NextResponse.json(
          { error: 'Profile not found or unauthorized' },
          { status: 404 },
        );
      }

      where.profileId = profileId;
    }

    // Optional filters
    if (contentType && contentType !== 'all') {
      where.contentType = contentType;
    }
    if (postOrigin && postOrigin !== 'all') {
      where.postOrigin = postOrigin;
    }
    if (platform && platform !== 'all') {
      where.platform = platform;
    }
    if (search) {
      where.OR = [
        { captionUsed: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Sorting
    const validSortFields = ['postedAt', 'captionUsed', 'revenue', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'postedAt';

    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.gallery_items.findMany({
        where: where as any,
        skip,
        take: pageSize,
        orderBy: { [orderField]: sortOrder },
        select: {
          id: true,
          captionUsed: true,
          contentType: true,
          platform: true,
          postOrigin: true,
          pricingTier: true,
          pageType: true,
          title: true,
          tags: true,
          revenue: true,
          salesCount: true,
          postedAt: true,
          createdAt: true,
          profileId: true,
          boardMetadata: true,
          previewUrl: true,
          profile: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      }),
      prisma.gallery_items.count({ where: where as any }),
    ]);

    // Expand Wall Post carousel items: each media item with a caption
    // becomes its own row in the caption bank (like OTP/PTR 1:1 mapping).
    type GalleryItem = (typeof items)[number];
    const expandedItems: Array<
      Omit<GalleryItem, 'id' | 'captionUsed' | 'contentType' | 'previewUrl' | 'title'> & {
        id: string;
        captionUsed: string | null;
        contentType: string | null;
        previewUrl: string | null;
        title: string | null;
      }
    > = [];

    for (const item of items) {
      const metadata = item.boardMetadata as Record<string, unknown> | null;
      const mediaItems = (metadata?.mediaItems ?? []) as Array<{
        url?: string;
        captionText?: string | null;
        contentType?: string;
        fileName?: string | null;
        contentItemId?: string;
      }>;

      if (mediaItems.length > 1) {
        // Wall Post carousel: expand each captioned media item into its own row
        let expandedAny = false;
        for (let i = 0; i < mediaItems.length; i++) {
          const mi = mediaItems[i];
          if (!mi.captionText?.trim()) continue;
          expandedAny = true;
          expandedItems.push({
            ...item,
            id: `${item.id}-${i}`,
            captionUsed: mi.captionText,
            contentType: mi.contentType || item.contentType,
            previewUrl: mi.url || item.previewUrl,
            title: item.title
              ? `${item.title} (${i + 1}/${mediaItems.length})`
              : `Media ${i + 1}/${mediaItems.length}`,
          });
        }
        if (!expandedAny) {
          expandedItems.push(item);
        }
      } else if (mediaItems.length === 1 && mediaItems[0].captionText?.trim()) {
        // Single-media wall post: use the media item's caption
        const mi = mediaItems[0];
        expandedItems.push({
          ...item,
          captionUsed: mi.captionText!,
          contentType: mi.contentType || item.contentType,
          previewUrl: mi.url || item.previewUrl,
        });
      } else {
        // OTP/PTR or no mediaItems: pass through unchanged
        expandedItems.push(item);
      }
    }

    const expandedTotal = total + (expandedItems.length - items.length);

    // Get unique filter values for the frontend dropdowns
    const [contentTypes, postOrigins, platforms] = await Promise.all([
      prisma.gallery_items.findMany({
        where: { ...where as any, contentType: undefined },
        distinct: ['contentType'],
        select: { contentType: true },
      }),
      prisma.gallery_items.findMany({
        where: { ...where as any, postOrigin: undefined },
        distinct: ['postOrigin'],
        select: { postOrigin: true },
      }),
      prisma.gallery_items.findMany({
        where: { ...where as any, platform: undefined },
        distinct: ['platform'],
        select: { platform: true },
      }),
    ]);

    return NextResponse.json({
      captions: expandedItems,
      pagination: {
        page,
        pageSize,
        total: expandedTotal,
        totalPages: Math.ceil(expandedTotal / pageSize),
      },
      filters: {
        contentTypes: contentTypes.map((c) => c.contentType).filter(Boolean),
        postOrigins: postOrigins.map((p) => p.postOrigin).filter(Boolean),
        platforms: platforms.map((p) => p.platform).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('[gallery/captions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gallery captions' },
      { status: 500 },
    );
  }
}
