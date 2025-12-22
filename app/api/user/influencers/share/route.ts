import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const shareLoRASchema = z.object({
  loraId: z.string().min(1),
  sharedWithClerkIds: z.array(z.string().min(1)).min(1),
  note: z.string().optional(),
});

/**
 * POST /api/user/influencers/share
 * Share a LoRA with other users
 */
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
    const validatedData = shareLoRASchema.parse(body);
    const { loraId, sharedWithClerkIds, note } = validatedData;

    console.log('📤 Share LoRA request:', {
      loraId,
      sharedWithClerkIds,
      ownerUserId: userId,
    });

    // Verify the user owns this LoRA
    const lora = await prisma.influencerLoRA.findFirst({
      where: {
        id: loraId,
        clerkId: userId,
      },
    });

    if (!lora) {
      return NextResponse.json(
        { error: 'LoRA not found or you do not have permission to share it' },
        { status: 404 }
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
        prisma.loRAShare.upsert({
          where: {
            loraId_sharedWithClerkId: {
              loraId,
              sharedWithClerkId,
            },
          },
          update: {
            note,
            sharedBy,
            updatedAt: new Date(),
          },
          create: {
            loraId,
            ownerClerkId: userId,
            sharedWithClerkId,
            note,
            sharedBy,
          },
        })
      )
    );

    console.log('✅ Created/updated LoRA shares:', shares.map(s => ({
      id: s.id,
      loraId: s.loraId,
      sharedWith: s.sharedWithClerkId,
    })));

    return NextResponse.json({
      success: true,
      shares,
      message: `LoRA shared with ${shares.length} user(s)`,
    });
  } catch (error) {
    console.error('Error sharing LoRA:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to share LoRA' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/influencers/share?loraId=xxx
 * Get list of users a LoRA is shared with
 */
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
    const loraId = searchParams.get('loraId');

    if (!loraId) {
      return NextResponse.json(
        { error: 'loraId is required' },
        { status: 400 }
      );
    }

    // Verify the user owns this LoRA
    const lora = await prisma.influencerLoRA.findFirst({
      where: {
        id: loraId,
        clerkId: userId,
      },
    });

    if (!lora) {
      return NextResponse.json(
        { error: 'LoRA not found or you do not have permission to view sharing info' },
        { status: 404 }
      );
    }

    const shares = await prisma.loRAShare.findMany({
      where: {
        loraId,
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
    console.error('Error fetching LoRA shares:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LoRA shares' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/influencers/share
 * Remove share access
 */
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
    const { loraId, sharedWithClerkId } = body;

    if (!loraId || !sharedWithClerkId) {
      return NextResponse.json(
        { error: 'loraId and sharedWithClerkId are required' },
        { status: 400 }
      );
    }

    // Verify the user owns this LoRA
    const lora = await prisma.influencerLoRA.findFirst({
      where: {
        id: loraId,
        clerkId: userId,
      },
    });

    if (!lora) {
      return NextResponse.json(
        { error: 'LoRA not found or you do not have permission to remove shares' },
        { status: 404 }
      );
    }

    // Delete the share
    await prisma.loRAShare.delete({
      where: {
        loraId_sharedWithClerkId: {
          loraId,
          sharedWithClerkId,
        },
      },
    });

    console.log(`✅ Removed LoRA share: ${loraId} from user ${sharedWithClerkId}`);

    return NextResponse.json({
      success: true,
      message: 'Share removed successfully',
    });
  } catch (error) {
    console.error('Error removing LoRA share:', error);
    return NextResponse.json(
      { error: 'Failed to remove share' },
      { status: 500 }
    );
  }
}
