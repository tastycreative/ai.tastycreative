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

    // Find the friend request with profile organization info
    const friendRequest = await prisma.friendship.findUnique({
      where: { id: requestId },
      include: {
        senderProfile: {
          select: {
            clerkId: true,
            organizationId: true,
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

    // Check if user owns the profile directly
    const isOwnProfile = friendRequest.senderProfile.clerkId === userId;
    
    // Check if user has access via organization with appropriate role
    let hasOrgAccess = false;
    if (!isOwnProfile && friendRequest.senderProfile.organizationId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
      });
      
      if (user) {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            userId: user.id,
            organizationId: friendRequest.senderProfile.organizationId,
            role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
          },
        });
        hasOrgAccess = !!teamMember;
      }
    }

    // Check if the current user has access to the sender profile
    if (!isOwnProfile && !hasOrgAccess) {
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
