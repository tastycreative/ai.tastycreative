import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = {
  params: Promise<{ spaceId: string; boardId: string; itemId: string }>;
};

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId/boards/:boardId/items/:itemId             */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;

    const item = await prisma.boardItem.findUnique({
      where: { id: itemId },
      include: {
        comments: { orderBy: { createdAt: 'desc' }, take: 50 },
        media: { orderBy: { createdAt: 'desc' } },
        column: { select: { id: true, name: true, color: true } },
      },
    });

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    return NextResponse.json({
      id: item.id,
      organizationId: item.organizationId,
      itemNo: item.itemNo,
      columnId: item.columnId,
      column: item.column,
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
      comments: item.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
      })),
      media: item.media.map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        name: m.name,
        size: m.size,
      })),
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/spaces/:spaceId/boards/:boardId/items/:itemId           */
/* ------------------------------------------------------------------ */

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string') data.title = body.title.trim();
    if (typeof body.description === 'string') data.description = body.description;
    if (body.columnId !== undefined) data.columnId = body.columnId;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.position !== undefined) data.position = body.position;
    if (body.metadata !== undefined) data.metadata = body.metadata;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId;
    if (body.dueDate !== undefined)
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    // Fetch current item to diff changes for history
    const current = await prisma.boardItem.findUnique({
      where: { id: itemId },
      select: {
        title: true,
        description: true,
        columnId: true,
        priority: true,
        position: true,
        metadata: true,
        assigneeId: true,
        dueDate: true,
      },
    });

    const updated = await prisma.boardItem.update({
      where: { id: itemId },
      data,
    });

    // Build history entries by comparing old vs new values
    if (current) {
      type HistoryRow = {
        itemId: string;
        userId: string;
        action: string;
        field: string;
        oldValue: string | null;
        newValue: string | null;
      };
      const historyEntries: HistoryRow[] = [];

      // Resolve column IDs to names for readable history
      const columnIds = new Set<string>();
      if (data.columnId !== undefined) {
        if (current.columnId) columnIds.add(current.columnId);
        if (typeof data.columnId === 'string') columnIds.add(data.columnId);
      }
      let columnNameMap: Record<string, string> = {};
      if (columnIds.size > 0) {
        const columns = await prisma.boardColumn.findMany({
          where: { id: { in: [...columnIds] } },
          select: { id: true, name: true },
        });
        columnNameMap = Object.fromEntries(columns.map((c) => [c.id, c.name]));
      }

      // Helper to format a value for display
      const formatValue = (field: string, val: unknown): string | null => {
        if (val == null) return null;
        if (field === 'columnId') return columnNameMap[String(val)] ?? String(val);
        if (field === 'priority') return String(val).charAt(0).toUpperCase() + String(val).slice(1).toLowerCase();
        if (field === 'dueDate' && val instanceof Date) return val.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return String(val);
      };

      // Track simple fields (skip position — it's just DnD reordering)
      const trackableFields = ['title', 'description', 'columnId', 'priority', 'assigneeId'] as const;
      for (const field of trackableFields) {
        if (data[field] === undefined) continue;
        const oldVal = current[field] ?? null;
        const newVal = data[field] ?? null;
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          historyEntries.push({
            itemId,
            userId,
            action: 'UPDATED',
            field,
            oldValue: formatValue(field, oldVal),
            newValue: formatValue(field, newVal),
          });
        }
      }

      // Track dueDate separately (Date comparison)
      if (data.dueDate !== undefined) {
        const oldDate = current.dueDate ?? null;
        const newDate = updated.dueDate ?? null;
        const oldStr = oldDate?.toISOString() ?? null;
        const newStr = newDate?.toISOString() ?? null;
        if (oldStr !== newStr) {
          historyEntries.push({
            itemId,
            userId,
            action: 'UPDATED',
            field: 'dueDate',
            oldValue: oldDate ? oldDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
            newValue: newDate ? newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
          });
        }
      }

      // Track metadata key-level diffs
      if (data.metadata !== undefined) {
        const oldMeta = (current.metadata as Record<string, unknown>) ?? {};
        const newMeta = (data.metadata as Record<string, unknown>) ?? {};
        const allKeys = new Set([...Object.keys(oldMeta), ...Object.keys(newMeta)]);
        for (const key of allKeys) {
          const oldVal = JSON.stringify(oldMeta[key] ?? null);
          const newVal = JSON.stringify(newMeta[key] ?? null);
          if (oldVal !== newVal) {
            historyEntries.push({
              itemId,
              userId,
              action: 'UPDATED',
              field: `metadata.${key}`,
              oldValue: oldMeta[key] != null ? String(oldMeta[key]) : null,
              newValue: newMeta[key] != null ? String(newMeta[key]) : null,
            });
          }
        }
      }

      if (historyEntries.length > 0) {
        await prisma.boardItemHistory.createMany({ data: historyEntries });
      }
    }

    return NextResponse.json({
      id: updated.id,
      organizationId: updated.organizationId,
      itemNo: updated.itemNo,
      columnId: updated.columnId,
      title: updated.title,
      description: updated.description,
      type: updated.type,
      priority: updated.priority,
      assigneeId: updated.assigneeId,
      dueDate: updated.dueDate?.toISOString() ?? null,
      position: updated.position,
      metadata: updated.metadata,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/spaces/:spaceId/boards/:boardId/items/:itemId          */
/* ------------------------------------------------------------------ */

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;

    await prisma.boardItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
