import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH /api/caption-queue/reorder - Reorder queue items
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body as { items: Array<{ id: string; sortOrder: number }> };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Verify all items belong to the user and update in a transaction
    await prisma.$transaction(
      items.map((item) =>
        prisma.captionQueueTicket.updateMany({
          where: {
            id: item.id,
            clerkId: userId,
          },
          data: {
            sortOrder: item.sortOrder,
            updatedAt: new Date(),
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering queue items:', error);
    return NextResponse.json(
      { error: 'Failed to reorder queue items' },
      { status: 500 }
    );
  }
}
