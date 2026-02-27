import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { publishBoardEvent } from '@/lib/ably';

type Params = {
  params: Promise<{ spaceId: string; boardId: string; itemId: string }>;
};

/* ------------------------------------------------------------------ */
/*  GET  .../items/:itemId/comments                                    */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;

    const comments = await prisma.boardItemComment.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST .../items/:itemId/comments                                    */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { boardId, itemId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }

    const comment = await prisma.boardItemComment.create({
      data: {
        itemId,
        createdBy: userId,
        content: body.content.trim(),
      },
    });

    const senderTab = req.headers.get('x-tab-id') ?? undefined;
    publishBoardEvent(boardId, 'comment.created', { userId, entityId: itemId, tabId: senderTab });

    return NextResponse.json(
      {
        id: comment.id,
        content: comment.content,
        createdBy: comment.createdBy,
        createdAt: comment.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
