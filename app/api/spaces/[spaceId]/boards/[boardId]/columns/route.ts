import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string; boardId: string }> };

/* ------------------------------------------------------------------ */
/*  POST /api/spaces/:spaceId/boards/:boardId/columns                 */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { boardId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Column name is required.' }, { status: 400 });
    }

    // Get the max position for this board
    const maxColumn = await prisma.boardColumn.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const nextPosition = (maxColumn?.position ?? -1) + 1;

    const column = await prisma.boardColumn.create({
      data: {
        boardId,
        name: body.name.trim(),
        color: body.color ?? 'blue',
        position: nextPosition,
      },
    });

    return NextResponse.json(
      {
        id: column.id,
        boardId: column.boardId,
        name: column.name,
        color: column.color,
        position: column.position,
        createdAt: column.createdAt.toISOString(),
        updatedAt: column.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating board column:', error);
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 });
  }
}
