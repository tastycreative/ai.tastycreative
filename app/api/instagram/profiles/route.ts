import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - List all profiles for the current user and their organization
export async function GET(request: NextRequest) {
  let userId: string | null = null;
  try {
    const auth_result = await auth();
    userId = auth_result.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if this is a request for specific profile IDs
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (idsParam) {
      // Fetch specific profiles by IDs
      const profileIds = idsParam.split(',').filter(Boolean);

      if (profileIds.length === 0) {
        return NextResponse.json({
          success: true,
          profiles: [],
        });
      }

      const profiles = await prisma.instagramProfile.findMany({
        where: {
          id: { in: profileIds },
        },
        select: {
          id: true,
          name: true,
          instagramUsername: true,
          profileImageUrl: true,
          clerkId: true,
          organizationId: true,
          user: {
            select: {
              id: true,
              clerkId: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        profiles,
      });
    }

    // Otherwise, return all accessible profiles for the user
    // Get user's current organization and check if they have CREATOR role
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { 
        currentOrganizationId: true,
        teamMemberships: {
          select: {
            role: true,
          },
        },
      },
    });

    // Check if user has CREATOR role (they could be creator in multiple orgs)
    const isCreator = user?.teamMemberships?.some(
      (membership) => membership.role === 'CREATOR'
    ) || false;

    // Build query based on user role
    let whereCondition: any;

    if (isCreator) {
      // CREATORS only see profiles assigned to them
      whereCondition = {
        assignments: {
          some: {
            assignedToClerkId: userId,
          },
        },
      };
    } else {
      // Regular users see: owned profiles + organization profiles + assigned profiles
      whereCondition = {
        OR: [
          { clerkId: userId }, // User's personal profiles
          { 
            assignments: {
              some: {
                assignedToClerkId: userId, // Profiles assigned to this user
              },
            },
          },
        ],
      };

      // Add organization profiles if user belongs to an organization
      if (user?.currentOrganizationId) {
        whereCondition.OR.push({
          organizationId: user.currentOrganizationId, // Organization's shared profiles
        });
      }
    }

    const profiles = await prisma.instagramProfile.findMany({
      where: whereCondition,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        _count: {
          select: {
            posts: true,
            feedPosts: true,
          },
        },
        linkedLoRAs: {
          select: {
            id: true,
            displayName: true,
            thumbnailUrl: true,
            fileName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        user: {
          select: {
            id: true,
            clerkId: true,
            name: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            email: true,
          },
        },
        assignments: {
          select: {
            id: true,
            assignedToClerkId: true,
            assignedAt: true,
          },
        },
      },
    });

    // Sort profiles: user's own profiles first, then shared profiles
    profiles.sort((a, b) => {
      const aIsOwn = a.clerkId === userId;
      const bIsOwn = b.clerkId === userId;
      
      // Own profiles come first
      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;
      
      // Within same category, default profiles come first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      
      // Then sort by creation date
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Get accepted friends count for each profile
    const profilesWithFriends = await Promise.all(
      profiles.map(async (profile) => {
        const friendsCount = await prisma.friendship.count({
          where: {
            OR: [
              { senderProfileId: profile.id, status: 'ACCEPTED' },
              { receiverProfileId: profile.id, status: 'ACCEPTED' },
            ],
          },
        });

        return {
          ...profile,
          _count: {
            ...profile._count,
            friends: friendsCount,
          },
        };
      })
    );

    return NextResponse.json({ success: true, profiles: profilesWithFriends });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      userId,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch profiles',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// POST - Create a new profile
export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const auth_result = await auth();
    userId = auth_result.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, instagramUsername, profileImageUrl, isDefault, shareWithOrganization } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      );
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    // If this is set as default, unset all other defaults for this user
    if (isDefault) {
      await prisma.instagramProfile.updateMany({
        where: {
          clerkId: userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const profile = await prisma.instagramProfile.create({
      data: {
        clerkId: userId,
        organizationId: shareWithOrganization && user?.currentOrganizationId ? user.currentOrganizationId : null,
        name: name.trim(),
        description: description?.trim() || null,
        instagramUsername: instagramUsername?.trim() || null,
        profileImageUrl: profileImageUrl || null,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ success: true, profile }, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      userId,
    });
    return NextResponse.json(
      { 
        error: 'Failed to create profile',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
