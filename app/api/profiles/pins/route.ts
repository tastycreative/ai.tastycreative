import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/profiles/pins - Fetch user's pinned profiles
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pins = await prisma.profilePin.findMany({
      where: { userId },
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
    });

    return NextResponse.json(pins);
  } catch (error) {
    console.error('Error fetching profile pins:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/profiles/pins - Pin a profile
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    }

    // Verify user has access to this profile
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        OR: [
          { clerkId: userId },
          {
            organization: {
              members: {
                some: {
                  user: { clerkId: userId },
                },
              },
            },
          },
        ],
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found or access denied' }, { status: 404 });
    }

    // Get the highest order value
    const lastPin = await prisma.profilePin.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
    });

    const newOrder = (lastPin?.order ?? -1) + 1;

    const pin = await prisma.profilePin.create({
      data: {
        userId,
        profileId,
        order: newOrder,
      },
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
    });

    return NextResponse.json(pin);
  } catch (error: any) {
    console.error('Error pinning profile:', error);
    
    // Handle unique constraint violation (already pinned)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Profile already pinned' }, { status: 409 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/profiles/pins/reorder - Reorder pinned profiles
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pinnedProfileIds } = body;

    if (!Array.isArray(pinnedProfileIds)) {
      return NextResponse.json({ error: 'Pinned profile IDs array required' }, { status: 400 });
    }

    // Update order for each pin
    const updatePromises = pinnedProfileIds.map((profileId, index) =>
      prisma.profilePin.updateMany({
        where: {
          userId,
          profileId,
        },
        data: {
          order: index,
        },
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering profile pins:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
