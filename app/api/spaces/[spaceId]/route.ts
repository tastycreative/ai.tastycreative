import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ spaceId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/spaces/:spaceId — full space with boards                  */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: spaceId },
      include: {
        boards: {
          orderBy: { position: 'asc' },
          include: {
            columns: { orderBy: { position: 'asc' } },
            _count: { select: { columns: true } },
          },
        },
      },
    });

    if (!workspace || !workspace.isActive) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      templateType: workspace.templateType,
      key: workspace.key,
      access: workspace.access,
      config: workspace.config,
      createdAt: workspace.createdAt.toISOString(),
      boards: workspace.boards.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        position: b.position,
        columns: b.columns.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          position: c.position,
        })),
        _count: b._count,
      })),
    });
  } catch (error) {
    console.error('Error fetching space:', error);
    return NextResponse.json({ error: 'Failed to fetch space' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/spaces/:spaceId — update space metadata                 */
/* ------------------------------------------------------------------ */

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string') data.name = body.name.trim();
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (body.access === 'OPEN' || body.access === 'PRIVATE') data.access = body.access;
    if (body.config !== undefined) data.config = body.config;

    const updated = await prisma.workspace.update({
      where: { id: spaceId },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      templateType: updated.templateType,
      key: updated.key,
      access: updated.access,
      config: updated.config,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating space:', error);
    return NextResponse.json({ error: 'Failed to update space' }, { status: 500 });
  }
}
