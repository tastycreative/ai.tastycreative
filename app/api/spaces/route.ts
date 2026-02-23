import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/* ------------------------------------------------------------------ */
/*  GET /api/spaces — list spaces for the current organization         */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json({ spaces: [] });
    }

    const workspaces = await prisma.workspace.findMany({
      where: { organizationId: user.currentOrganizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { boards: true, members: true } },
        members: {
          where: { userId: user.id },
          select: { role: true },
        },
      },
    });

    const spaces = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      templateType: ws.templateType,
      key: ws.key,
      access: ws.access,
      config: ws.config,
      createdAt: ws.createdAt.toISOString(),
      _count: ws._count,
      currentUserRole: ws.members[0]?.role || null,
    }));

    return NextResponse.json({ spaces });
  } catch (error) {
    console.error('Error fetching spaces:', error);
    return NextResponse.json({ error: 'Failed to fetch spaces' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/spaces — create a new space with default board + columns */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to create spaces.' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    const name = body.name.trim();
    const templateType = body.templateType ?? 'KANBAN';
    const key = body.key?.trim() || null;
    const access = body.access === 'PRIVATE' ? 'PRIVATE' : 'OPEN';
    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null;

    // Unique slug within the org
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;
    while (
      await prisma.workspace.findFirst({
        where: { organizationId: user.currentOrganizationId, slug },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${suffix++}`;
    }

    // Build config from user-provided data
    const config: Record<string, unknown> = {
      ...(body.statuses ? { defaultColumns: body.statuses } : {}),
      ...(body.workTypes ? { workTypes: body.workTypes } : {}),
    };

    // Resolve columns from user input or fallback defaults
    const columns = body.statuses ?? [
      { name: 'To Do', color: 'blue', position: 0 },
      { name: 'In Progress', color: 'amber', position: 1 },
      { name: 'Done', color: 'green', position: 2 },
    ];

    // Create space + default board + columns in a transaction
    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          organizationId: user.currentOrganizationId!,
          name,
          slug,
          description,
          templateType: templateType as any,
          key,
          access: access as any,
          config: Object.keys(config).length > 0 ? (config as any) : undefined,
          color: 'brand-light-pink',
          icon: templateType,
        },
      });

      await tx.board.create({
        data: {
          workspaceId: ws.id,
          name: 'Main Board',
          position: 0,
          columns: {
            create: columns.map(
              (col: { name: string; color?: string; position: number }) => ({
                name: col.name,
                color: col.color ?? null,
                position: col.position,
              }),
            ),
          },
        },
      });

      // Add the creator as OWNER of the workspace
      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      return ws;
    });

    return NextResponse.json(
      {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description,
        templateType: workspace.templateType,
        key: workspace.key,
        access: workspace.access,
        config: workspace.config,
        createdAt: workspace.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating space:', error);
    return NextResponse.json({ error: 'Failed to create space' }, { status: 500 });
  }
}
