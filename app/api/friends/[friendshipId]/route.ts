import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// DELETE - Remove friend
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ friendshipId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { friendshipId } = await params;

    // Get the current user's database ID and organization
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, currentOrganizationId: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the friendship with profile info
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
      include: {
        senderProfile: {
          select: {
            id: true,
            clerkId: true,
            organizationId: true,
          },
        },
        receiverProfile: {
          select: {
            id: true,
            clerkId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: 'Friendship not found' },
        { status: 404 }
      );
    }

    // Check if user has access to either profile in the friendship
    const checkProfileAccess = async (profile: { clerkId: string; organizationId: string | null }) => {
      // Direct ownership
      if (profile.clerkId === userId) return true;
      
      // Organization access with appropriate role
      if (profile.organizationId && profile.organizationId === currentUser.currentOrganizationId) {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            userId: currentUser.id,
            organizationId: profile.organizationId,
            role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
          },
        });
        return !!teamMember;
      }
      
      return false;
    };

    const hasSenderAccess = await checkProfileAccess(friendship.senderProfile);
    const hasReceiverAccess = await checkProfileAccess(friendship.receiverProfile);

    // Verify that the current user has access to at least one profile in this friendship
    if (!hasSenderAccess && !hasReceiverAccess) {
      return NextResponse.json(
        { error: 'You are not authorized to remove this friendship' },
        { status: 403 }
      );
    }

    // Delete the friendship
    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    return NextResponse.json({
      message: 'Friend removed successfully',
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    return NextResponse.json(
      { error: 'Failed to remove friend' },
      { status: 500 }
    );
  }
}
