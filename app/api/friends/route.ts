import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch profile's friends
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Verify the profile belongs to the current user
    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        clerkId: userId,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get all accepted friendships for this profile
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderProfileId: profileId, status: 'ACCEPTED' },
          { receiverProfileId: profileId, status: 'ACCEPTED' },
        ],
      },
      include: {
        senderProfile: {
          include: {
            user: {
              select: {
                clerkId: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        receiverProfile: {
          include: {
            user: {
              select: {
                clerkId: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Format the response to show the friend profile (not the current profile)
    const friends = friendships.map((friendship) => {
      const friendProfile = friendship.senderProfileId === profileId 
        ? friendship.receiverProfile 
        : friendship.senderProfile;
      
      return {
        id: friendship.id,
        profileId: profileId,
        friendProfileId: friendProfile.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        friendProfile: {
          id: friendProfile.id,
          name: friendProfile.name,
          instagramUsername: friendProfile.instagramUsername,
          profileImageUrl: friendProfile.profileImageUrl,
          user: {
            clerkId: friendProfile.user.clerkId,
            email: friendProfile.user.email,
            firstName: friendProfile.user.firstName,
            lastName: friendProfile.user.lastName,
          },
        },
      };
    });

    return NextResponse.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}
