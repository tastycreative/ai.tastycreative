import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH - Update a profile
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
    const body = await request.json();
    const { name, description, instagramUsername, profileImageUrl, isDefault } = body;

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

    // If setting as default, unset all other defaults
    if (isDefault && !existingProfile.isDefault) {
      await prisma.instagramProfile.updateMany({
        where: {
          clerkId: userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updatedProfile = await prisma.instagramProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(instagramUsername !== undefined && { instagramUsername: instagramUsername?.trim() || null }),
        ...(profileImageUrl !== undefined && { profileImageUrl: profileImageUrl || null }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a profile
export async function DELETE(
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
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if profile has posts
    if (existingProfile._count.posts > 0) {
      // Delete all posts associated with this profile first
      await prisma.instagramPost.deleteMany({
        where: {
          profileId: id,
          clerkId: userId, // Extra safety check
        },
      });
    }

    await prisma.instagramProfile.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Profile deleted successfully',
      deletedPosts: existingProfile._count.posts,
    });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 }
    );
  }
}
