import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// DELETE - Cancel friend request
export async function DELETE(
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

    // Find the friend request
    const friendRequest = await prisma.friendship.findUnique({
      where: { id: requestId },
      include: {
        senderProfile: {
          select: {
            clerkId: true,
          },
        },
      },
    });

    if (!friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Check if the current user owns the sender profile
    if (friendRequest.senderProfile.clerkId !== userId) {
      return NextResponse.json(
        { error: 'You can only cancel requests you sent' },
        { status: 403 }
      );
    }

    // Check if the request is pending
    if (friendRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending requests can be cancelled' },
        { status: 400 }
      );
    }

    // Delete the friend request
    await prisma.friendship.delete({
      where: { id: requestId },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Friend request cancelled successfully' 
    });
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel friend request' },
      { status: 500 }
    );
  }
}
