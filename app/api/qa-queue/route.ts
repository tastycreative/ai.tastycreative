import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { canManageQueue, type OrgRole } from '@/lib/rbac';

/**
 * GET /api/qa-queue
 *
 * Fetch all board items sitting in a "QA" column across OTP_PTR boards
 * in the user's current organization.
 *
 * Returns enriched items with model profile data, flyer assets, and media.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }

    const orgId = user.currentOrganizationId;

    // Check permission — only OWNER / ADMIN / MANAGER can access QA queue
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id, organizationId: orgId },
      select: { role: true },
    });
    const role = (membership?.role ?? null) as OrgRole | null;
    if (!canManageQueue(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find all board items in "QA" columns across OTP_PTR boards in this org
    const items = await prisma.boardItem.findMany({
      where: {
        organizationId: orgId,
        column: {
          name: { equals: 'QA', mode: 'insensitive' },
          board: {
            workspace: {
              organizationId: orgId,
              templateType: 'OTP_PTR',
            },
          },
        },
      },
      include: {
        column: {
          select: {
            id: true,
            name: true,
            board: {
              select: {
                id: true,
                workspace: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        media: {
          select: {
            id: true,
            url: true,
            type: true,
            name: true,
            size: true,
          },
        },
        _count: {
          select: { comments: true, media: true },
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdBy: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' as const },
          take: 50,
        },
        history: {
          select: {
            id: true,
            userId: true,
            action: true,
            field: true,
            oldValue: true,
            newValue: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 30,
        },
      },
      orderBy: [
        { position: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Collect unique profile IDs from metadata.model names
    const modelNames = new Set<string>();
    for (const item of items) {
      const meta = (item.metadata ?? {}) as Record<string, unknown>;
      if (typeof meta.model === 'string' && meta.model) {
        modelNames.add(meta.model.toLowerCase());
      }
    }

    // Batch fetch profiles by name
    const profiles = modelNames.size > 0
      ? await prisma.instagramProfile.findMany({
          where: {
            organizationId: orgId,
            name: { in: [...modelNames], mode: 'insensitive' },
          },
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            pageStrategy: true,
            modelBible: true,
          },
        })
      : [];

    const profilesByName = new Map<string, typeof profiles[0]>();
    for (const p of profiles) {
      profilesByName.set(p.name.toLowerCase(), p);
    }

    // Batch fetch flyer assets linked to these board items
    const itemIds = items.map((i) => i.id);
    const flyerAssets = itemIds.length > 0
      ? await prisma.flyerAsset.findMany({
          where: {
            organizationId: orgId,
            boardItemId: { in: itemIds },
          },
          select: {
            id: true,
            boardItemId: true,
            profileId: true,
            fileName: true,
            fileType: true,
            url: true,
            fileSize: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const flyersByItemId = new Map<string, typeof flyerAssets>();
    for (const fa of flyerAssets) {
      if (!fa.boardItemId) continue;
      const list = flyersByItemId.get(fa.boardItemId) ?? [];
      list.push(fa);
      flyersByItemId.set(fa.boardItemId, list);
    }

    // Fetch all columns for these boards (for column move actions)
    const boardIds = [...new Set(items.map((i) => i.column.board.id))];
    const allColumns = boardIds.length > 0
      ? await prisma.boardColumn.findMany({
          where: { boardId: { in: boardIds } },
          select: { id: true, name: true, boardId: true, position: true },
          orderBy: { position: 'asc' },
        })
      : [];

    const columnsByBoardId = new Map<string, typeof allColumns>();
    for (const col of allColumns) {
      const list = columnsByBoardId.get(col.boardId) ?? [];
      list.push(col);
      columnsByBoardId.set(col.boardId, list);
    }

    // Build response
    const enrichedItems = items.map((item) => {
      const meta = (item.metadata ?? {}) as Record<string, unknown>;
      const modelName = (meta.model as string) ?? '';
      const profile = profilesByName.get(modelName.toLowerCase()) ?? null;

      return {
        id: item.id,
        itemNo: item.itemNo,
        title: item.title,
        description: item.description,
        priority: item.priority,
        assigneeId: item.assigneeId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        columnId: item.columnId,
        columnName: item.column.name,
        boardId: item.column.board.id,
        spaceId: item.column.board.workspace.id,
        spaceSlug: item.column.board.workspace.slug,
        spaceName: item.column.board.workspace.name,
        metadata: meta,
        media: item.media,
        _count: item._count,
        comments: item.comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
        history: item.history.map((h) => ({
          ...h,
          createdAt: h.createdAt.toISOString(),
        })),
        modelProfile: profile
          ? {
              id: profile.id,
              name: profile.name,
              profileImageUrl: profile.profileImageUrl,
              pageStrategy: profile.pageStrategy,
              modelBible: profile.modelBible,
            }
          : null,
        flyerAssets: flyersByItemId.get(item.id) ?? [],
        boardColumns: columnsByBoardId.get(item.column.board.id) ?? [],
      };
    });

    return NextResponse.json({ items: enrichedItems });
  } catch (error) {
    console.error('[QA Queue GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
