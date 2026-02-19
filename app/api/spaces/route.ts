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

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        currentOrganizationId: true,
      },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { spaces: [] },
        { status: 200 },
      );
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: user.currentOrganizationId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const spaces = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      // For now, all spaces use a general Kanban template
      templateType: 'KANBAN' as const,
      createdAt: ws.createdAt.toISOString(),
    }));

    return NextResponse.json({ spaces });
  } catch (error) {
    console.error('Error fetching spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spaces' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to create spaces.' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required.' },
        { status: 400 },
      );
    }

    const name = body.name.trim();
    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null;

    if (!name) {
      return NextResponse.json(
        { error: 'Name cannot be empty.' },
        { status: 400 },
      );
    }

    // Template type is reserved for future extension, but we accept it for completeness.
    const templateType =
      body.templateType === 'KANBAN' || !body.templateType
        ? 'KANBAN'
        : 'KANBAN';

    // Ensure slug is unique within the organization
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await prisma.workspace.findFirst({
        where: {
          organizationId: user.currentOrganizationId,
          slug,
        },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const workspace = await prisma.workspace.create({
      data: {
        organizationId: user.currentOrganizationId,
        name,
        slug,
        description,
        // Use brand-related defaults to visually align with the rest of the app
        color: 'brand-light-pink',
        icon: 'Kanban',
      },
    });

    const space = {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      templateType,
      createdAt: workspace.createdAt.toISOString(),
    };

    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    console.error('Error creating space:', error);
    return NextResponse.json(
      { error: 'Failed to create space' },
      { status: 500 },
    );
  }
}

