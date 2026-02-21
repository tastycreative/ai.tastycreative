import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/profile-groups - Fetch all groups for organization
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Verify user belongs to this organization
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        user: { clerkId: userId },
        organizationId,
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const groups = await prisma.profileGroup.findMany({
      where: { organizationId },
      include: {
        members: {
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
                instagramUsername: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Add member count to each group
    const groupsWithCount = groups.map(group => ({
      ...group,
      memberCount: group.members.length,
    }));

    return NextResponse.json(groupsWithCount);
  } catch (error) {
    console.error('Error fetching profile groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/profile-groups - Create new group
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color, icon, organizationId } = body;

    if (!name || !organizationId) {
      return NextResponse.json({ error: 'Name and organization ID required' }, { status: 400 });
    }

    // Verify user belongs to this organization
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        user: { clerkId: userId },
        organizationId,
      },
    });

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get the highest order value
    const lastGroup = await prisma.profileGroup.findFirst({
      where: { organizationId },
      orderBy: { order: 'desc' },
    });

    const newOrder = (lastGroup?.order ?? -1) + 1;

    const group = await prisma.profileGroup.create({
      data: {
        name,
        color,
        icon,
        organizationId,
        order: newOrder,
      },
      include: {
        members: {
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
                instagramUsername: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ ...group, memberCount: 0 });
  } catch (error: any) {
    console.error('Error creating profile group:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A group with this name already exists in this organization' },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
