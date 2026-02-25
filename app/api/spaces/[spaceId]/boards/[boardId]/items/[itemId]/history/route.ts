import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = {
  params: Promise<{ spaceId: string; boardId: string; itemId: string }>;
};

/* ------------------------------------------------------------------ */
/*  GET .../items/:itemId/history                                      */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { itemId } = await params;

    const history = await prisma.boardItemHistory.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        action: h.action,
        field: h.field,
        oldValue: h.oldValue,
        newValue: h.newValue,
        userId: h.userId,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
