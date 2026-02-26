import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/profile-groups - Fetch all groups for user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groups = await prisma.profileGroup.findMany({
      where: { userId },
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
    const { name, color, icon } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    // Get the highest order value for this user
    const lastGroup = await prisma.profileGroup.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
    });

    const newOrder = (lastGroup?.order ?? -1) + 1;

    const group = await prisma.profileGroup.create({
      data: {
        name,
        color,
        icon,
        userId,
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
        { error: 'A group with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
