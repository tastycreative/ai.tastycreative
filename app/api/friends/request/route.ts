import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileId, senderProfileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    if (!senderProfileId) {
      return NextResponse.json(
        { error: 'Sender profile ID is required' },
        { status: 400 }
      );
    }

    // Verify sender profile belongs to current user
    const senderProfile = await prisma.instagramProfile.findFirst({
      where: {
        id: senderProfileId,
        clerkId: userId,
      },
    });

    if (!senderProfile) {
      return NextResponse.json(
        { error: 'Sender profile not found or unauthorized' },
        { status: 404 }
      );
    }

    // Find the target profile
    const targetProfile = await prisma.instagramProfile.findUnique({
      where: { id: profileId },
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
    });

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if trying to add the same profile
    if (targetProfile.id === senderProfile.id) {
      return NextResponse.json(
        { error: 'You cannot send a friend request to the same profile' },
        { status: 400 }
      );
    }

    // Check if friendship already exists (in either direction)
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          {
            senderProfileId: senderProfile.id,
            receiverProfileId: targetProfile.id,
          },
          {
            senderProfileId: targetProfile.id,
            receiverProfileId: senderProfile.id,
          },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'These profiles are already friends' },
          { status: 400 }
        );
      } else if (existingFriendship.status === 'PENDING') {
        return NextResponse.json(
          { error: 'A friend request is already pending' },
          { status: 400 }
        );
      } else if (existingFriendship.status === 'REJECTED') {
        // Allow sending a new request by updating the existing one
        await prisma.friendship.update({
          where: { id: existingFriendship.id },
          data: {
            senderProfile: { connect: { id: senderProfile.id } },
            receiverProfile: { connect: { id: targetProfile.id } },
            status: 'PENDING',
            updatedAt: new Date(),
          },
        });
        return NextResponse.json({ 
          message: 'Friend request sent successfully',
          friendship: existingFriendship 
        });
      }
    }

    // Create new friend request
    const friendship = await prisma.friendship.create({
      data: {
        senderProfile: { connect: { id: senderProfile.id } },
        receiverProfile: { connect: { id: targetProfile.id } },
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
    });

    return NextResponse.json({ 
      message: 'Friend request sent successfully',
      friendship 
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}
