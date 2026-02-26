import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// POST /api/profile-groups/[id]/members - Add profiles to group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await request.json();
    const { profileIds } = body;

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json({ error: 'Profile IDs array required' }, { status: 400 });
    }

    // Verify group exists and belongs to user
    const group = await prisma.profileGroup.findUnique({
      where: { id: groupId },
      include: {
        members: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized to modify this group' }, { status: 403 });
    }

    // Get the highest order value in this group
    const lastMember = await prisma.profileGroupMember.findFirst({
      where: { profileGroupId: groupId },
      orderBy: { order: 'desc' },
    });

    let nextOrder = (lastMember?.order ?? -1) + 1;

    // Add profiles to group (skip if already member)
    const members = [];
    for (const profileId of profileIds) {
      try {
        const member = await prisma.profileGroupMember.create({
          data: {
            profileGroupId: groupId,
            profileId,
            order: nextOrder++,
          },
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
        });
        members.push(member);
      } catch (error: any) {
        // Skip if already exists (P2002 unique constraint violation)
        if (error.code !== 'P2002') {
          throw error;
        }
      }
    }

    return NextResponse.json({ members, added: members.length });
  } catch (error) {
    console.error('Error adding profiles to group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/profile-groups/[id]/members?profileId=xxx - Remove profile from group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
    }

    // Verify group exists and belongs to user
    const group = await prisma.profileGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized to modify this group' }, { status: 403 });
    }

    // Remove the profile from the group
    await prisma.profileGroupMember.deleteMany({
      where: {
        profileGroupId: groupId,
        profileId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing profile from group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
