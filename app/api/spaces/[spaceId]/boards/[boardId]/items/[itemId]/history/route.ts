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

    // Collect unique user IDs
    const userIds = [...new Set(history.map((h) => h.userId))];

    // Fetch user information for all unique user IDs
    const users = await prisma.user.findMany({
      where: { clerkId: { in: userIds } },
      select: { clerkId: true, firstName: true, lastName: true, email: true },
    });

    // Create a map of userId -> display name
    const userMap = new Map(
      users.map((u) => {
        const displayName = u.firstName && u.lastName
          ? `${u.firstName} ${u.lastName}`
          : u.firstName || u.lastName || u.email || 'Unknown User';
        return [u.clerkId, displayName];
      })
    );

    return NextResponse.json({
      history: history.map((h) => ({
        id: h.id,
        action: h.action,
        field: h.field,
        oldValue: h.oldValue,
        newValue: h.newValue,
        userId: h.userId,
        userName: userMap.get(h.userId) || 'Unknown User',
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
