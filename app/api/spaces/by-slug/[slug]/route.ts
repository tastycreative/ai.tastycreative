import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { slug } = await params;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user?.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        organizationId: user.currentOrganizationId,
        slug,
        isActive: true,
      },
      include: {
        boards: {
          orderBy: { position: 'asc' },
          include: {
            columns: { orderBy: { position: 'asc' } },
          },
        },
        members: {
          where: { role: 'OWNER' },
          include: {
            users: {
              select: {
                id: true,
                clerkId: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const owner = workspace.members[0]?.users;

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
      owner: owner
        ? {
            id: owner.id,
            clerkId: owner.clerkId,
            name: owner.name,
            email: owner.email,
          }
        : null,
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
      })),
    });
  } catch (error) {
    console.error('Error fetching space by slug:', error);
    return NextResponse.json({ error: 'Failed to fetch space' }, { status: 500 });
  }
}
