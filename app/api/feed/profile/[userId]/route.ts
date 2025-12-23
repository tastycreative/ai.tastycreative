// app\api\feed\profile\[userId]\route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET - Fetch user profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: profileUserId } = await params;

    // Fetch the profile user
    const profileUser = await prisma.user.findUnique({
      where: { id: profileUserId },
      select: {
        id: true,
        clerkId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        imageUrl: true,
        coverImageUrl: true,
      },
    });

    if (!profileUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: currentUserId },
      select: { id: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }

    // Count posts
    const postsCount = await prisma.feedPost.count({
      where: { userId: profileUserId },
    });

    // Count friends (accepted friendships)
    // TODO: Fix this - Friendship model uses senderProfileId/receiverProfileId not senderId/receiverId
    const friendsCount = 0; // await prisma.friendship.count({
    //   where: {
    //     OR: [
    //       { senderId: profileUserId, status: 'ACCEPTED' },
    //       { receiverId: profileUserId, status: 'ACCEPTED' },
    //     ],
    //   },
    // });

    // Check if current user is friends with profile user
    // TODO: Fix this - Friendship model uses senderProfileId/receiverProfileId not senderId/receiverId
    const friendship = null; // await prisma.friendship.findFirst({
    //   where: {
    //     OR: [
    //       { senderId: currentUser.id, receiverId: profileUserId, status: 'ACCEPTED' },
    //       { senderId: profileUserId, receiverId: currentUser.id, status: 'ACCEPTED' },
    //     ],
    //   },
    // });

    const isOwnProfile = currentUser.id === profileUserId;
    const isFriend = !!friendship;

    return NextResponse.json({
      id: profileUser.id,
      clerkId: profileUser.clerkId,
      username: profileUser.username,
      firstName: profileUser.firstName,
      lastName: profileUser.lastName,
      email: profileUser.email,
      imageUrl: profileUser.imageUrl,
      coverImageUrl: profileUser.coverImageUrl,
      postsCount,
      friendsCount,
      isFriend,
      isOwnProfile,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
