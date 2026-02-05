import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch pending friend requests for a profile
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
    const type = searchParams.get('type') || 'received'; // 'received' or 'sent'
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Verify the profile belongs to the current user or is shared with them
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const profile = await prisma.instagramProfile.findFirst({
      where: {
        id: profileId,
        OR: [
          { clerkId: userId }, // User's own profile
          { organizationId: user.currentOrganizationId }, // Shared via organization
        ],
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found or unauthorized' },
        { status: 404 }
      );
    }

    if (type === 'sent') {
      // Get all pending friend requests sent by this profile
      const sentRequests = await prisma.friendship.findMany({
        where: {
          senderProfileId: profileId,
          status: 'PENDING',
        },
        include: {
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
          createdAt: 'desc',
        },
      });

      const formattedRequests = sentRequests.map((request) => ({
        id: request.id,
        fromProfileId: request.senderProfileId,
        toProfileId: request.receiverProfileId,
        status: request.status,
        createdAt: request.createdAt,
        toProfile: {
          id: request.receiverProfile.id,
          name: request.receiverProfile.name,
          instagramUsername: request.receiverProfile.instagramUsername,
          profileImageUrl: request.receiverProfile.profileImageUrl,
          user: {
            clerkId: request.receiverProfile.user.clerkId,
            email: request.receiverProfile.user.email,
            firstName: request.receiverProfile.user.firstName,
            lastName: request.receiverProfile.user.lastName,
          },
        },
      }));

      return NextResponse.json(formattedRequests);
    }

    // Get all pending friend requests received by this profile
    const friendRequests = await prisma.friendship.findMany({
      where: {
        receiverProfileId: profileId,
        status: 'PENDING',
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format the response
    const formattedRequests = friendRequests.map((request) => ({
      id: request.id,
      fromProfileId: request.senderProfileId,
      toProfileId: request.receiverProfileId,
      status: request.status,
      createdAt: request.createdAt,
      fromProfile: {
        id: request.senderProfile.id,
        name: request.senderProfile.name,
        instagramUsername: request.senderProfile.instagramUsername,
        profileImageUrl: request.senderProfile.profileImageUrl,
        user: {
          clerkId: request.senderProfile.user.clerkId,
          email: request.senderProfile.user.email,
          firstName: request.senderProfile.user.firstName,
          lastName: request.senderProfile.user.lastName,
        },
      },
    }));

    return NextResponse.json(formattedRequests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friend requests' },
      { status: 500 }
    );
  }
}
