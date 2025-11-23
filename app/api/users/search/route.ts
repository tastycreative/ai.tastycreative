import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

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
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Search for users by username only
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            username: {
              contains: query,
              mode: 'insensitive',
            },
          },
          // Exclude the current user from results
          {
            NOT: {
              clerkId: userId,
            },
          },
        ],
      },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
      take: 10, // Limit results to 10
    });

    // Get all existing friendships for current user
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

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: currentUser.id },
          { receiverId: currentUser.id },
        ],
        status: {
          in: ['PENDING', 'ACCEPTED'],
        },
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    // Create a set of friend IDs to exclude
    const friendIds = new Set<string>();
    friendships.forEach((friendship) => {
      if (friendship.senderId === currentUser.id) {
        friendIds.add(friendship.receiverId);
      } else {
        friendIds.add(friendship.senderId);
      }
    });

    // Filter out users who are already friends or have pending requests
    const filteredUsers = users.filter(
      (user) => !friendIds.has(user.id)
    );

    return NextResponse.json(filteredUsers);
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
