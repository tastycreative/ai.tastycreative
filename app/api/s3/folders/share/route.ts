import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const shareFolderSchema = z.object({
  folderPrefix: z.string().min(1), // e.g., "outputs/user_123/nov-2/"
  sharedWithClerkIds: z.array(z.string().min(1)).min(1), // Array of user IDs to share with
  permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
  note: z.string().optional(),
});

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
    const validatedData = shareFolderSchema.parse(body);
    const { folderPrefix, sharedWithClerkIds, permission, note } = validatedData;

    console.log('📤 Share request:', {
      folderPrefix,
      sharedWithClerkIds,
      permission,
      ownerUserId: userId,
    });

    // Verify the user owns this folder
    if (!folderPrefix.startsWith(`outputs/${userId}/`)) {
      return NextResponse.json(
        { error: 'You can only share your own folders' },
        { status: 403 }
      );
    }

    // Get current user info for "sharedBy" field
    const currentUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const userName = currentUser?.firstName && currentUser?.lastName 
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser?.firstName || currentUser?.lastName || '';
    const sharedBy = userName || currentUser?.email || userId;

    // Create shares for all specified users
    const shares = await Promise.all(
      sharedWithClerkIds.map((sharedWithClerkId) =>
        prisma.folderShare.upsert({
          where: {
            folderPrefix_sharedWithClerkId: {
              folderPrefix,
              sharedWithClerkId,
            },
          },
          update: {
            permission,
            note,
            sharedBy,
            updatedAt: new Date(),
          },
          create: {
            folderPrefix,
            ownerClerkId: userId,
            sharedWithClerkId,
            permission,
            note,
            sharedBy,
          },
        })
      )
    );

    console.log('✅ Created/updated shares:', shares.map(s => ({
      id: s.id,
      folderPrefix: s.folderPrefix,
      sharedWith: s.sharedWithClerkId,
      permission: s.permission,
    })));

    return NextResponse.json({
      success: true,
      shares,
      message: `Folder shared with ${shares.length} user(s)`,
    });
  } catch (error) {
    console.error('Error sharing folder:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to share folder' },
      { status: 500 }
    );
  }
}

// Get list of users a folder is shared with
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
    const folderPrefix = searchParams.get('folderPrefix');

    if (!folderPrefix) {
      return NextResponse.json(
        { error: 'folderPrefix is required' },
        { status: 400 }
      );
    }

    // Verify the user owns this folder
    if (!folderPrefix.startsWith(`outputs/${userId}/`)) {
      return NextResponse.json(
        { error: 'You can only view sharing info for your own folders' },
        { status: 403 }
      );
    }

    const shares = await prisma.folderShare.findMany({
      where: {
        folderPrefix,
        ownerClerkId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get user details for each share
    const sharesWithUserInfo = await Promise.all(
      shares.map(async (share) => {
        const user = await prisma.user.findUnique({
          where: { clerkId: share.sharedWithClerkId },
          select: { email: true, firstName: true, lastName: true, imageUrl: true },
        });
        
        const userName = user?.firstName && user?.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user?.firstName || user?.lastName || '';
        
        return {
          ...share,
          sharedWithUser: {
            ...user,
            displayName: userName || user?.email || 'Unknown User',
          },
        };
      })
    );

    return NextResponse.json({ shares: sharesWithUserInfo });
  } catch (error) {
    console.error('Error fetching folder shares:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folder shares' },
      { status: 500 }
    );
  }
}

// Remove share access
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { folderPrefix, sharedWithClerkId } = body;

    if (!folderPrefix || !sharedWithClerkId) {
      return NextResponse.json(
        { error: 'folderPrefix and sharedWithClerkId are required' },
        { status: 400 }
      );
    }

    // Verify the user owns this folder
    if (!folderPrefix.startsWith(`outputs/${userId}/`)) {
      return NextResponse.json(
        { error: 'You can only unshare your own folders' },
        { status: 403 }
      );
    }

    await prisma.folderShare.delete({
      where: {
        folderPrefix_sharedWithClerkId: {
          folderPrefix,
          sharedWithClerkId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Share access removed',
    });
  } catch (error) {
    console.error('Error unsharing folder:', error);
    return NextResponse.json(
      { error: 'Failed to remove share access' },
      { status: 500 }
    );
  }
}
