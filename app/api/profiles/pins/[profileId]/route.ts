import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// DELETE /api/profiles/pins/[profileId] - Unpin a profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId } = await params;

    // Delete the pin
    await prisma.profilePin.deleteMany({
      where: {
        userId,
        profileId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unpinning profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
