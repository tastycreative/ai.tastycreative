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

    const updated = await prisma.boardItem.update({
      where: { id: itemId },
      data,
    });

    return NextResponse.json({
      id: updated.id,
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
