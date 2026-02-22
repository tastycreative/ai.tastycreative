import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string; boardId: string; itemId: string; mediaId: string }> };

/* ------------------------------------------------------------------ */
/*  DELETE /api/spaces/:spaceId/boards/:boardId/items/:itemId/media/:mediaId */
/* ------------------------------------------------------------------ */

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId, mediaId } = await params;

    const media = await prisma.boardItemMedia.findFirst({
      where: { id: mediaId, itemId },
    });

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    await prisma.boardItemMedia.delete({ where: { id: mediaId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board item media:', error);
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
