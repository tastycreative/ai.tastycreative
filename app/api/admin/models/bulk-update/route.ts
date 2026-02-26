import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess();

    const body = await req.json();
    const { profileIds, updates } = body;

    // Validate input
    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Profile IDs are required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Updates object is required' },
        { status: 400 }
      );
    }

    // Build update object - only allow status and type fields
    const allowedUpdates: { status?: string; type?: string } = {};
    if (updates.status) allowedUpdates.status = updates.status;
    if (updates.type) allowedUpdates.type = updates.type;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Update profiles
    const result = await prisma.instagramProfile.updateMany({
      where: {
        id: {
          in: profileIds,
        },
      },
      data: allowedUpdates,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} profile(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error updating profiles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profiles' },
      { status: 500 }
    );
  }
}
