import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';

type Params = { params: Promise<{ spaceId: string; boardId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId/boards/:boardId/items                     */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { boardId } = await params;

    // Fetch the board's columns so we know the board exists
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: { orderBy: { position: 'asc' } },
      },
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Fetch all items across all columns of this board
    const items = await prisma.boardItem.findMany({
      where: { columnId: { in: board.columns.map((c) => c.id) } },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { comments: true, media: true } },
      },
    });

    return NextResponse.json({
      columns: board.columns.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        position: c.position,
      })),
      items: items.map((item) => ({
        id: item.id,
        organizationId: item.organizationId,
        itemNo: item.itemNo,
        columnId: item.columnId,
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
        _count: item._count,
      })),
    });
  } catch (error) {
    console.error('Error fetching board items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/boards/:boardId/items                    */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId, boardId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    if (!body.columnId) {
      return NextResponse.json({ error: 'columnId is required.' }, { status: 400 });
    }

    // Get the workspace to retrieve organizationId
    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get the next itemNo for this organization
    const maxItem = await prisma.boardItem.findFirst({
      where: { organizationId: workspace.organizationId },
      orderBy: { itemNo: 'desc' },
      select: { itemNo: true },
    });

    const nextItemNo = (maxItem?.itemNo ?? 0) + 1;

    const item = await prisma.boardItem.create({
      data: {
        organizationId: workspace.organizationId,
        itemNo: nextItemNo,
        columnId: body.columnId,
        title: body.title.trim(),
        description: body.description?.trim() ?? null,
        type: body.type ?? 'TASK',
        priority: body.priority ?? 'MEDIUM',
        position: 0,
        metadata: body.metadata ?? null,
        assigneeId: body.assigneeId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        createdBy: userId,
      },
    });

    // Record creation in history
    await prisma.boardItemHistory.create({
      data: {
        itemId: item.id,
        userId,
        action: 'CREATED',
        field: 'item',
        newValue: item.title,
      },
    });

    const senderTab = req.headers.get('x-tab-id') ?? undefined;
    publishBoardEvent(boardId, 'item.created', { userId, entityId: item.id, tabId: senderTab });

    return NextResponse.json(
      {
        id: item.id,
        organizationId: item.organizationId,
        itemNo: item.itemNo,
        columnId: item.columnId,
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
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating board item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
