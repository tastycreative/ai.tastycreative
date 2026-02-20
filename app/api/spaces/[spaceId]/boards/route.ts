import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId/boards                                    */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;

    const boards = await prisma.board.findMany({
      where: { workspaceId: spaceId },
      orderBy: { position: 'asc' },
      include: {
        columns: { orderBy: { position: 'asc' } },
      },
    });

    return NextResponse.json({
      boards: boards.map((b) => ({
        id: b.id,
        workspaceId: b.workspaceId,
        name: b.name,
        description: b.description,
        position: b.position,
        columns: b.columns.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          position: c.position,
        })),
      })),
    });
  } catch (error) {
    console.error('Error fetching boards:', error);
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/boards                                   */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    const maxPos = await prisma.board.aggregate({
      where: { workspaceId: spaceId },
      _max: { position: true },
    });

    const board = await prisma.board.create({
      data: {
        workspaceId: spaceId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        position: (maxPos._max.position ?? -1) + 1,
        columns: body.columns
          ? {
              create: (
                body.columns as { name: string; color?: string; position: number }[]
              ).map((c) => ({
                name: c.name,
                color: c.color ?? null,
                position: c.position,
              })),
            }
          : undefined,
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    });

    return NextResponse.json(
      {
        id: board.id,
        workspaceId: board.workspaceId,
        name: board.name,
        description: board.description,
        position: board.position,
        columns: board.columns.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          position: c.position,
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
