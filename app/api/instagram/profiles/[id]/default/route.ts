import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH - Set profile as default
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify profile belongs to user
    const existingProfile = await prisma.instagramProfile.findFirst({
      where: {
        id,
        clerkId: userId,
      },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Unset all other defaults
    await prisma.instagramProfile.updateMany({
      where: {
        clerkId: userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    // Set this profile as default
    const updatedProfile = await prisma.instagramProfile.update({
      where: { id },
      data: {
        isDefault: true,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error('Error setting default profile:', error);
    return NextResponse.json(
      { error: 'Failed to set default profile' },
      { status: 500 }
    );
  }
}
