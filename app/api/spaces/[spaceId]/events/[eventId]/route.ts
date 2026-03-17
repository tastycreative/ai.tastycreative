import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string; eventId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, eventId } = await params;

  try {
    const event = await prisma.workspaceEvent.findFirst({
      where: { id: eventId, workspaceId: spaceId },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to fetch event:', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ spaceId: string; eventId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, eventId } = await params;
  const body = await req.json();
  const { title, startDate, endDate, description, allDay, color } = body;

  try {
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (description !== undefined) data.description = description || null;
    if (allDay !== undefined) data.allDay = allDay;
    if (color !== undefined) data.color = color || null;

    const event = await prisma.workspaceEvent.update({
      where: { id: eventId, workspaceId: spaceId },
      data,
    });
    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to update event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string; eventId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, eventId } = await params;

  try {
    await prisma.workspaceEvent.delete({
      where: { id: eventId, workspaceId: spaceId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
