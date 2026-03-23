import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

/**
 * POST /api/qa-queue/[id]/comments
 *
 * Add a comment to a board item from the QA workspace.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: itemId } = await params;
    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify the item exists
    const item = await prisma.boardItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const comment = await prisma.boardItemComment.create({
      data: {
        itemId,
        content,
        createdBy: clerkId,
      },
      select: {
        id: true,
        content: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[QA Comment POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
