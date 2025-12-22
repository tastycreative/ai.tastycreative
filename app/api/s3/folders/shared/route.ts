import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// Get folders that are shared with the current user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all folders shared with this user
    const shares = await prisma.folderShare.findMany({
      where: {
        sharedWithClerkId: userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Get owner details for each share
    const sharesWithOwnerInfo = await Promise.all(
      shares.map(async (share) => {
        const owner = await prisma.user.findUnique({
          where: { clerkId: share.ownerClerkId },
          select: { email: true, firstName: true, lastName: true, imageUrl: true },
        });
        
        const ownerName = owner?.firstName && owner?.lastName 
          ? `${owner.firstName} ${owner.lastName}`
          : owner?.firstName || owner?.lastName || '';
        
        // Extract folder name from prefix (e.g., "outputs/user_123/nov-2/" -> "nov-2")
        const folderName = share.folderPrefix.split('/').filter(Boolean).pop() || 'Unknown';
        
        return {
          ...share,
          folderName,
          owner: {
            ...owner,
            displayName: ownerName || owner?.email || 'Unknown User',
          },
        };
      })
    );

    return NextResponse.json({ sharedFolders: sharesWithOwnerInfo });
  } catch (error) {
    console.error('Error fetching shared folders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared folders' },
      { status: 500 }
    );
  }
}
