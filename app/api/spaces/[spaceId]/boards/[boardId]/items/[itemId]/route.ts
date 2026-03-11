import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';
import { saveCaptionFromOtpPtr } from '@/lib/caption-bank-sync';
import { sendBoardMoveNotification } from '@/lib/board-move-notification';
import { sendBoardAssignNotification } from '@/lib/board-assign-notification';

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

    const { spaceId, boardId, itemId } = await params;
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

      // Helper to format a value for display — never returns [object Object]
      const formatValue = (field: string, val: unknown): string | null => {
        if (val == null) return null;
        if (field === 'columnId') return columnNameMap[String(val)] ?? String(val);
        if (field === 'priority') return String(val).charAt(0).toUpperCase() + String(val).slice(1).toLowerCase();
        if (field === 'dueDate' && val instanceof Date) return val.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (Array.isArray(val)) return `${val.length} item${val.length !== 1 ? 's' : ''}`;
        if (typeof val === 'object') return JSON.stringify(val);
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

        // Humanize UPPER_SNAKE_CASE / snake_case status strings
        // e.g. "PENDING_CAPTION" → "Pending Caption", "in_progress" → "In Progress"
        const humanizeStatus = (val: string): string =>
          val
            .split(/[_\s]+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');

        // Dynamically format any metadata value for readable history storage
        const formatMetaValue = (key: string, val: unknown): string | null => {
          if (val == null) return null;
          if (Array.isArray(val)) {
            if (val.length === 0) return 'none';
            // Array of primitives (tags, hashtags) → show values if short
            if (val.every((v) => typeof v === 'string' || typeof v === 'number')) {
              const joined = (val as (string | number)[]).join(', ');
              if (joined.length <= 60) return joined;
            }
            // Checklist → show completed/total
            if (val.every((v) => typeof v === 'object' && v !== null && 'text' in (v as Record<string, unknown>))) {
              const completed = val.filter((v) => (v as { completed?: boolean }).completed).length;
              return `${completed}/${val.length} completed`;
            }
            // Files / captionItems → file count
            if (val.every((v) => typeof v === 'object' && v !== null && 'fileName' in (v as Record<string, unknown>))) {
              return `${val.length} file${val.length !== 1 ? 's' : ''}`;
            }
            return `${val.length} item${val.length !== 1 ? 's' : ''}`;
          }
          if (typeof val === 'boolean') return val ? 'Yes' : 'No';
          if (typeof val === 'string') {
            // ISO date strings → readable
            if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
              try {
                return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
              } catch { return val; }
            }
            // Clerk user IDs
            if (/^user_[a-zA-Z0-9]+$/.test(val)) return val;
            // UPPER_SNAKE or snake_case status/enum values (e.g. PENDING_CAPTION, in_progress)
            if (/^[A-Z][A-Z0-9_]+$/.test(val) || (key.toLowerCase().includes('status') && /^[a-z][a-z0-9_]+$/.test(val))) {
              return humanizeStatus(val);
            }
            // Prisma-style cuid/uuid IDs — hide the raw value
            if (/^c[a-z0-9]{20,}$/.test(val) && key.toLowerCase().endsWith('id')) {
              return null;
            }
            return val;
          }
          if (typeof val === 'object') {
            const keys = Object.keys(val as Record<string, unknown>);
            return `${keys.length} field${keys.length !== 1 ? 's' : ''}`;
          }
          return String(val);
        };

        // Diff checklist items individually for meaningful history
        type ChecklistItem = { id: string; text: string; completed?: boolean; order?: number };
        const diffChecklist = (
          oldList: ChecklistItem[],
          newList: ChecklistItem[],
        ): HistoryRow[] => {
          const rows: HistoryRow[] = [];
          const oldMap = new Map(oldList.map((s) => [s.id, s]));
          const newMap = new Map(newList.map((s) => [s.id, s]));

          // Added steps
          for (const s of newList) {
            if (!oldMap.has(s.id)) {
              rows.push({ itemId, userId, action: 'UPDATED', field: 'checklist', oldValue: null, newValue: `Added "${s.text}"` });
            }
          }
          // Removed steps
          for (const s of oldList) {
            if (!newMap.has(s.id)) {
              rows.push({ itemId, userId, action: 'UPDATED', field: 'checklist', oldValue: `Removed "${s.text}"`, newValue: null });
            }
          }
          // Toggled or renamed
          for (const s of newList) {
            const old = oldMap.get(s.id);
            if (!old) continue;
            if (old.completed !== s.completed) {
              rows.push({
                itemId, userId, action: 'UPDATED', field: 'checklist',
                oldValue: null,
                newValue: s.completed ? `Completed "${s.text}"` : `Unchecked "${s.text}"`,
              });
            }
            if (old.text !== s.text) {
              rows.push({
                itemId, userId, action: 'UPDATED', field: 'checklist',
                oldValue: old.text, newValue: s.text,
              });
            }
          }
          // Reordered (only if no adds/removes and order changed)
          if (rows.length === 0 && oldList.length === newList.length) {
            const orderChanged = newList.some((s, i) => oldList[i]?.id !== s.id);
            if (orderChanged) {
              rows.push({ itemId, userId, action: 'UPDATED', field: 'checklist', oldValue: null, newValue: 'Reordered steps' });
            }
          }
          return rows;
        };

        for (const key of allKeys) {
          // Skip underscore-prefixed internal keys and large structural keys
          if (key.startsWith('_') || key === 'fieldOrder' || key === 'fields') continue;
          const oldVal = JSON.stringify(oldMeta[key] ?? null);
          const newVal = JSON.stringify(newMeta[key] ?? null);
          if (oldVal === newVal) continue;

          // Detailed checklist diff
          if (key === 'checklist' && Array.isArray(oldMeta[key]) && Array.isArray(newMeta[key])) {
            historyEntries.push(...diffChecklist(
              oldMeta[key] as ChecklistItem[],
              newMeta[key] as ChecklistItem[],
            ));
            continue;
          }

          historyEntries.push({
            itemId,
            userId,
            action: 'UPDATED',
            field: `metadata.${key}`,
            oldValue: formatMetaValue(key, oldMeta[key]),
            newValue: formatMetaValue(key, newMeta[key]),
          });
        }
      }

      if (historyEntries.length > 0) {
        // Safety net: never store [object Object] in history — sanitize all values
        const sanitize = (v: string | null): string | null => {
          if (v == null) return null;
          if (v.includes('[object Object]')) {
            const count = v.split('[object Object]').length - 1;
            return `${count} item${count !== 1 ? 's' : ''}`;
          }
          return v;
        };
        const sanitized = historyEntries.map((e) => ({
          ...e,
          oldValue: sanitize(e.oldValue),
          newValue: sanitize(e.newValue),
        }));
        await prisma.boardItemHistory.createMany({ data: sanitized });
      }
    }

    // ── Auto-save caption to Caption Bank when item moves to "Posted" column ──
    if (data.columnId !== undefined && current) {
      const oldColumnId = current.columnId;
      const newColumnId = data.columnId as string;

      if (oldColumnId !== newColumnId) {
        try {
          // Resolve the new column name
          const newColumn = await prisma.boardColumn.findUnique({
            where: { id: newColumnId },
            select: { name: true },
          });

          if (newColumn?.name?.toLowerCase() === 'posted') {
            const itemMeta = (updated.metadata as Record<string, unknown>) ?? {};
            await saveCaptionFromOtpPtr({
              boardItemId: itemId,
              metadata: itemMeta,
              clerkId: userId,
            });
          }
        } catch (e) {
          // Non-blocking: don't fail the column move
          console.error('[caption-bank-sync] Failed to auto-save caption on column move:', e);
        }
      }
    }

    // ── Fire-and-forget board move notification ──
    if (data.columnId !== undefined && current && current.columnId !== data.columnId) {
      // Resolve column names for the notification
      const notifColumns = await prisma.boardColumn.findMany({
        where: { id: { in: [current.columnId, data.columnId as string] } },
        select: { id: true, name: true },
      });
      const notifColMap = Object.fromEntries(notifColumns.map((c) => [c.id, c.name]));

      sendBoardMoveNotification({
        boardId,
        itemId,
        itemTitle: updated.title,
        itemNo: updated.itemNo,
        oldColumnId: current.columnId,
        oldColumnName: notifColMap[current.columnId] ?? current.columnId,
        newColumnId: data.columnId as string,
        newColumnName: notifColMap[data.columnId as string] ?? (data.columnId as string),
        movedByUserId: userId,
        assigneeId: updated.assigneeId,
        createdBy: updated.createdBy,
        spaceId,
      }).catch((e) => console.error('[board-move-notification]', e));
    }

    // ── Fire-and-forget assignee notification ──
    if (
      data.assigneeId !== undefined &&
      current &&
      current.assigneeId !== data.assigneeId &&
      data.assigneeId // only when assigning, not unassigning
    ) {
      sendBoardAssignNotification({
        itemId,
        itemTitle: updated.title,
        itemNo: updated.itemNo,
        assigneeClerkId: data.assigneeId as string,
        assignedByUserId: userId,
        spaceId,
      }).catch((e) => console.error('[board-assign-notification]', e));
    }

    const senderTab = req.headers.get('x-tab-id') ?? undefined;
    publishBoardEvent(boardId, 'item.updated', { userId, entityId: itemId, tabId: senderTab });

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

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { boardId, itemId } = await params;

    await prisma.boardItem.delete({ where: { id: itemId } });

    const senderTab = req.headers.get('x-tab-id') ?? undefined;
    publishBoardEvent(boardId, 'item.deleted', { userId, entityId: itemId, tabId: senderTab });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
