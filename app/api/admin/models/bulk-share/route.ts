import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import { requireAdminAccess } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin access
    await requireAdminAccess();

    const body = await request.json();
    const { profileIds, organizationId } = body;

    // Validate input
    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Profile IDs are required' },
        { status: 400 }
      );
    }

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Update all profiles to share with organization
    const result = await prisma.instagramProfile.updateMany({
      where: {
        id: {
          in: profileIds,
        },
      },
      data: {
        organizationId: organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully shared ${result.count} profile(s) with ${organization.name}`,
      data: {
        updated: result.count,
        organizationName: organization.name,
      },
    });
  } catch (error) {
    console.error('Error sharing profiles to organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to share profiles',
      },
      { status: 500 }
    );
  }
}
