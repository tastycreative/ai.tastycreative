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
    const { clerkId, email } = body;

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

    // Find the target user by clerkId or email
    let targetUser;
    if (clerkId) {
      targetUser = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, clerkId: true, email: true, firstName: true, lastName: true },
      });
    } else if (email) {
      targetUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
        select: { id: true, clerkId: true, email: true, firstName: true, lastName: true },
      });
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if trying to add themselves
    if (targetUser.id === currentUser.id) {
      return NextResponse.json(
        { error: 'You cannot send a friend request to yourself' },
        { status: 400 }
      );
    }

    // Check if friendship already exists (in either direction)
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          {
            sender: { id: currentUser.id },
            receiver: { id: targetUser.id },
          },
          {
            sender: { id: targetUser.id },
            receiver: { id: currentUser.id },
          },
        ],
      },
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'ACCEPTED') {
        return NextResponse.json(
          { error: 'You are already friends with this user' },
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
            sender: { connect: { id: currentUser.id } },
            receiver: { connect: { id: targetUser.id } },
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
        sender: { connect: { id: currentUser.id } },
        receiver: { connect: { id: targetUser.id } },
        status: 'PENDING',
      },
      include: {
        receiver: {
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
