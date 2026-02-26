import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

/**
 * GET /api/admin/models
 * Fetches all models/profiles for admin management
 * Optimized for performance with parallel queries and lean selects
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAccess();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100); // Cap at 100
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const assignedTo = searchParams.get('assignedTo') || '';
    const includeRelations = searchParams.get('includeRelations') !== 'false';

    // Build where clause
    const where: any = {};

    if (search) {
      // Use startsWith for indexed prefix search when possible, falls back to contains
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { instagramUsername: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (assignedTo) {
      where.clerkId = assignedTo;
    }

    // Run count and data queries in parallel for better performance
    const [totalCount, profiles] = await Promise.all([
      prisma.instagramProfile.count({ where }),
      prisma.instagramProfile.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { updatedAt: 'desc' },
        ],
        select: {
          id: true,
          clerkId: true,
          name: true,
          description: true,
          instagramUsername: true,
          profileImageUrl: true,
          isDefault: true,
          status: true,
          type: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          tags: true,
          // Conditionally include relations for lighter payloads
          ...(includeRelations ? {
            user: {
              select: {
                id: true,
                clerkId: true,
                firstName: true,
                lastName: true,
                email: true,
                imageUrl: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            linkedLoRAs: {
              select: {
                id: true,
                displayName: true,
                thumbnailUrl: true,
                fileName: true,
              },
              take: 5, // Limit LoRAs to reduce payload
            },
            assignments: {
              select: {
                id: true,
                assignedToClerkId: true,
                assignedAt: true,
                assignedBy: true,
              },
            },
            _count: {
              select: {
                posts: true,
                feedPosts: true,
                captions: true,
              },
            },
          } : {
            _count: {
              select: {
                posts: true,
                feedPosts: true,
              },
            },
          }),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profiles,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching models:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
