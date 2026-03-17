import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ spaceId: string; resourceId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, resourceId } = await params;
  const body = await req.json();
  const { name, url, description, category } = body;

  try {
    const resource = await prisma.workspaceResource.update({
      where: { id: resourceId, workspaceId: spaceId },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(description !== undefined && { description: description || null }),
        ...(category !== undefined && { category: category || null }),
      },
    });
    return NextResponse.json(resource);
  } catch (error) {
    console.error('Failed to update resource:', error);
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ spaceId: string; resourceId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, resourceId } = await params;

  try {
    await prisma.workspaceResource.delete({
      where: { id: resourceId, workspaceId: spaceId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete resource:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}
