import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/profile-groups/[id]/shares - Get all shares for a group
export async function GET(
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
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const shares = await prisma.profileGroupShare.findMany({
      where: { profileGroupId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with user info
    const clerkIds = shares.map(s => s.sharedWithClerkId);
    const users = await prisma.user.findMany({
      where: { clerkId: { in: clerkIds } },
      select: {
        clerkId: true,
        name: true,
        email: true,
        imageUrl: true,
        firstName: true,
        lastName: true,
      },
    });

    const userMap = new Map(users.map(u => [u.clerkId, u]));

    const enrichedShares = shares.map(share => ({
      ...share,
      sharedWithUser: userMap.get(share.sharedWithClerkId) || null,
    }));

    return NextResponse.json(enrichedShares);
  } catch (error) {
    console.error('Error fetching group shares:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/profile-groups/[id]/shares - Share group with users
export async function POST(
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
    const { userClerkIds, permission = 'VIEW', note } = body;

    if (!Array.isArray(userClerkIds) || userClerkIds.length === 0) {
      return NextResponse.json({ error: 'userClerkIds required' }, { status: 400 });
    }

    // Verify group exists and belongs to user
    const group = await prisma.profileGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized to share this group' }, { status: 403 });
    }

    // Prevent sharing with yourself
    const filteredIds = userClerkIds.filter((cid: string) => cid !== userId);
    if (filteredIds.length === 0) {
      return NextResponse.json({ error: 'Cannot share a group with yourself' }, { status: 400 });
    }

    // Validate permission value
    const validPermissions = ['VIEW', 'USE', 'EDIT'];
    if (!validPermissions.includes(permission)) {
      return NextResponse.json({ error: 'Invalid permission' }, { status: 400 });
    }

    // Create shares (skip duplicates)
    const results = [];
    for (const clerkId of filteredIds) {
      try {
        const share = await prisma.profileGroupShare.upsert({
          where: {
            profileGroupId_sharedWithClerkId: {
              profileGroupId: id,
              sharedWithClerkId: clerkId,
            },
          },
          update: { permission, note },
          create: {
            profileGroupId: id,
            ownerClerkId: userId,
            sharedWithClerkId: clerkId,
            permission,
            sharedBy: userId,
            note,
          },
        });
        results.push(share);
      } catch (err) {
        console.error(`Failed to share with ${clerkId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      shared: results.length,
      total: filteredIds.length,
    });
  } catch (error) {
    console.error('Error sharing group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/profile-groups/[id]/shares - Remove a share
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
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get('shareId');

    if (!shareId) {
      return NextResponse.json({ error: 'shareId required' }, { status: 400 });
    }

    // Verify group exists and belongs to user
    const group = await prisma.profileGroup.findUnique({
      where: { id },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    if (group.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await prisma.profileGroupShare.delete({
      where: { id: shareId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing group share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
