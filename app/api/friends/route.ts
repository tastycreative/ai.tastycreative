import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch user's friends
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    // Get all accepted friendships
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, status: 'ACCEPTED' },
          { receiverId: currentUser.id, status: 'ACCEPTED' },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Format the response to show the friend (not the current user)
    const friends = friendships.map((friendship) => {
      const friend = friendship.senderId === currentUser.id 
        ? friendship.receiver 
        : friendship.sender;
      
      return {
        id: friendship.id,
        userId: currentUser.id,
        friendId: friend.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        friend: {
          clerkId: friend.clerkId,
          email: friend.email,
          firstName: friend.firstName,
          lastName: friend.lastName,
          imageUrl: friend.imageUrl,
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
