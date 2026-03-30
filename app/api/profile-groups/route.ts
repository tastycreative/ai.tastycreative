import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/profile-groups - Fetch all groups for user (owned + shared with)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's own groups
    const ownedGroups = await prisma.profileGroup.findMany({
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
        shares: {
          select: { id: true, sharedWithClerkId: true, permission: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Fetch groups shared with this user
    const sharedWithMe = await prisma.profileGroupShare.findMany({
      where: { sharedWithClerkId: userId },
      include: {
        profileGroup: {
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
        },
      },
    });

    // Get owner info for shared groups
    const ownerClerkIds = [...new Set(sharedWithMe.map(s => s.ownerClerkId))];
    const owners = ownerClerkIds.length > 0
      ? await prisma.user.findMany({
          where: { clerkId: { in: ownerClerkIds } },
          select: { clerkId: true, name: true, email: true, imageUrl: true },
        })
      : [];
    const ownerMap = new Map(owners.map(o => [o.clerkId, o]));

    // Format owned groups
    const formattedOwned = ownedGroups.map(group => ({
      ...group,
      memberCount: group.members.length,
      shareCount: group.shares.length,
      isSharedWithMe: false,
      isOwner: true,
      permission: 'OWNER' as const,
      owner: null,
    }));

    // Format shared groups
    const formattedShared = sharedWithMe.map(share => ({
      ...share.profileGroup,
      memberCount: share.profileGroup.members.length,
      shares: [],
      shareCount: 0,
      isSharedWithMe: true,
      isOwner: false,
      permission: share.permission,
      owner: ownerMap.get(share.ownerClerkId) || null,
    }));

    return NextResponse.json([...formattedOwned, ...formattedShared]);
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
