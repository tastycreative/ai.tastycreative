import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = {
  params: Promise<{ contentItemId: string }>;
};

/* ------------------------------------------------------------------ */
/*  GET  .../content-items/:contentItemId/comments                    */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contentItemId } = await params;

    const comments = await prisma.contentItemComment.findMany({
      where: { contentItemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Collect unique user IDs
    const userIds = [...new Set(comments.map((c) => c.createdBy))];

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
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdBy: c.createdBy,
        author: userMap.get(c.createdBy) || 'Unknown User',
        createdAt: c.createdAt.toISOString(),
        contentItemId: c.contentItemId,
      })),
    });
  } catch (error) {
    console.error('Error fetching content item comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST .../content-items/:contentItemId/comments                    */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contentItemId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }

    const comment = await prisma.contentItemComment.create({
      data: {
        contentItemId,
        createdBy: userId,
        content: body.content.trim(),
      },
    });

    // Get user information for the author
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const author = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.lastName || user?.email || 'Unknown User';

    return NextResponse.json(
      {
        id: comment.id,
        content: comment.content,
        createdBy: comment.createdBy,
        author,
        createdAt: comment.createdAt.toISOString(),
        contentItemId: comment.contentItemId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error adding content item comment:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
