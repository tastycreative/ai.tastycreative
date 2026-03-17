import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId } = await params;
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    const where: Record<string, unknown> = { workspaceId: spaceId };

    if (start || end) {
      where.startDate = {};
      if (start) (where.startDate as Record<string, unknown>).gte = new Date(start);
      if (end) (where.startDate as Record<string, unknown>).lte = new Date(end);
    }

    const events = await prisma.workspaceEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId } = await params;
  const body = await req.json();
  const { title, startDate, endDate, description, allDay, color } = body;

  if (!title || !startDate || !endDate) {
    return NextResponse.json({ error: 'title, startDate, and endDate are required' }, { status: 400 });
  }

  try {
    const event = await prisma.workspaceEvent.create({
      data: {
        workspaceId: spaceId,
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description: description || null,
        allDay: allDay ?? false,
        color: color || null,
        createdBy: userId,
      },
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Failed to create event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
