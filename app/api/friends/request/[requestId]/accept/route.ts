import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST - Accept friend request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { requestId } = await params;

    // Get the current user's database ID
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the friendship request
    const friendship = await prisma.friendship.findUnique({
      where: { id: requestId },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Verify that the current user is the receiver
    if (friendship.receiverId !== currentUser.id) {
      return NextResponse.json(
        { error: 'You are not authorized to accept this request' },
        { status: 403 }
      );
    }

    // Verify that the request is still pending
    if (friendship.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'This friend request is no longer pending' },
        { status: 400 }
      );
    }

    // Update the friendship status to ACCEPTED
    const updatedFriendship = await prisma.friendship.update({
      where: { id: requestId },
      data: {
        status: 'ACCEPTED',
        updatedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Friend request accepted',
      friendship: updatedFriendship,
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return NextResponse.json(
      { error: 'Failed to accept friend request' },
      { status: 500 }
    );
  }
}
