import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET - Fetch pending friend requests
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

    if (type === 'sent') {
      // Get all pending friend requests sent by the user
      const sentRequests = await prisma.friendship.findMany({
        where: {
          senderId: currentUser.id,
          status: 'PENDING',
        },
        include: {
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
          createdAt: 'desc',
        },
      });

      const formattedRequests = sentRequests.map((request) => ({
        id: request.id,
        fromUserId: request.senderId,
        toUserId: request.receiverId,
        status: request.status,
        createdAt: request.createdAt,
        toUser: {
          clerkId: request.receiver.clerkId,
          email: request.receiver.email,
          firstName: request.receiver.firstName,
          lastName: request.receiver.lastName,
          imageUrl: request.receiver.imageUrl,
        },
      }));

      return NextResponse.json(formattedRequests);
    }

    // Get all pending friend requests received by the user
    const friendRequests = await prisma.friendship.findMany({
      where: {
        receiverId: currentUser.id,
        status: 'PENDING',
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format the response
    const formattedRequests = friendRequests.map((request) => ({
      id: request.id,
      fromUserId: request.senderId,
      toUserId: request.receiverId,
      status: request.status,
      createdAt: request.createdAt,
      fromUser: {
        clerkId: request.sender.clerkId,
        email: request.sender.email,
        firstName: request.sender.firstName,
        lastName: request.sender.lastName,
        imageUrl: request.sender.imageUrl,
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
