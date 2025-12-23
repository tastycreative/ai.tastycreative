import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST - Reject friend request
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

    // Find the friendship request
    const friendship = await prisma.friendship.findUnique({
      where: { id: requestId },
      include: {
        receiverProfile: {
          select: {
            clerkId: true,
          },
        },
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Verify that the current user owns the receiver profile
    if (friendship.receiverProfile.clerkId !== userId) {
      return NextResponse.json(
        { error: 'You are not authorized to reject this request' },
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

    // Update the friendship status to REJECTED
    const updatedFriendship = await prisma.friendship.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Friend request rejected',
      friendship: updatedFriendship,
    });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return NextResponse.json(
      { error: 'Failed to reject friend request' },
      { status: 500 }
    );
  }
}
