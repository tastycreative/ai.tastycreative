import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// Debug endpoint to check folder shares
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get all folder shares
    const allShares = await prisma.folderShare.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get shares where current user is owner
    const myShares = allShares.filter(s => s.ownerClerkId === userId);

    // Get shares where current user is recipient
    const sharedWithMe = allShares.filter(s => s.sharedWithClerkId === userId);

    return NextResponse.json({
      currentUser: userId,
      totalUsers: allUsers.length,
      totalShares: allShares.length,
      users: allUsers,
      allShares: allShares,
      myShares: myShares,
      sharedWithMe: sharedWithMe,
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug info' },
      { status: 500 }
    );
  }
}
