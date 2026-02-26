import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// PATCH /api/profile-groups/[id] - Update group
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
    const { name, color, icon, order, isCollapsed } = body;

    // Verify group exists and belongs to user
    const group = await prisma.profileGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized to modify this group' }, { status: 403 });
    }

    const updatedGroup = await prisma.profileGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(isCollapsed !== undefined && { isCollapsed }),
      },
      include: {
        members: {
          include: {
            profile: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
                instagramUsername: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ ...updatedGroup, memberCount: updatedGroup.members.length });
  } catch (error: any) {
    console.error('Error updating profile group:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A group with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/profile-groups/[id] - Delete group
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

    // Verify group exists and belongs to user
    const group = await prisma.profileGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized to delete this group' }, { status: 403 });
    }

    // Delete the group (members will be cascade deleted)
    await prisma.profileGroup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting profile group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
