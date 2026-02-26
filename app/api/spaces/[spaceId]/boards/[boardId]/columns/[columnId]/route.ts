import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string; boardId: string; columnId: string }> };

/* ------------------------------------------------------------------ */
/*  PATCH /api/spaces/:spaceId/boards/:boardId/columns/:columnId     */
/* ------------------------------------------------------------------ */

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { columnId } = await params;
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    // Validate that at least one field is being updated
    if (!body.name && !body.color) {
      return NextResponse.json({ error: 'At least one field (name or color) must be provided' }, { status: 400 });
    }

    // Build update data
    const updateData: { name?: string; color?: string } = {};
    if (body.name && typeof body.name === 'string') {
      updateData.name = body.name.trim();
    }
    if (body.color && typeof body.color === 'string') {
      updateData.color = body.color;
    }

    // Update the column
    const column = await prisma.boardColumn.update({
      where: { id: columnId },
      data: updateData,
    });

    return NextResponse.json({
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      color: column.color,
      position: column.position,
      createdAt: column.createdAt.toISOString(),
      updatedAt: column.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating board column:', error);
    return NextResponse.json({ error: 'Failed to update column' }, { status: 500 });
  }
}
