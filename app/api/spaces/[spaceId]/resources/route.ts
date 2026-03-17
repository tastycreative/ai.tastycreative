import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId } = await params;

  try {
    const resources = await prisma.workspaceResource.findMany({
      where: { workspaceId: spaceId },
      orderBy: { position: 'asc' },
    });
    return NextResponse.json(resources);
  } catch (error) {
    console.error('Failed to fetch resources:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
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
  const { name, url, description, category } = body;

  if (!name || !url) {
    return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
  }

  try {
    // Get max position for ordering
    const last = await prisma.workspaceResource.findFirst({
      where: { workspaceId: spaceId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const resource = await prisma.workspaceResource.create({
      data: {
        workspaceId: spaceId,
        name,
        url,
        description: description || null,
        category: category || null,
        position: (last?.position ?? -1) + 1,
        createdBy: userId,
      },
    });
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error('Failed to create resource:', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}
