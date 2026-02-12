import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';
import {
  calculateOrganizationStorage,
  updateOrganizationStorageUsage,
  checkStorageLimit,
} from '@/lib/storageTracking';

/**
 * GET /api/billing/storage
 * Get detailed storage breakdown for the current organization
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const organizationId = user.currentOrganizationId;

    // Get storage breakdown
    const breakdown = await calculateOrganizationStorage(organizationId);

    // Update organization's currentStorageGB field with the calculated value
    await prisma.organization.update({
      where: { id: organizationId },
      data: { currentStorageGB: breakdown.totalGB },
    });

    // Check limits (now with updated currentStorageGB)
    const limitCheck = await checkStorageLimit(organizationId);

    return NextResponse.json({
      breakdown,
      limits: limitCheck,
    });
  } catch (error: unknown) {
    console.error('Error fetching storage breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/storage/recalculate
 * Recalculate and update organization's storage usage
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        teamMemberships: {
          where: {
            organizationId: user?.currentOrganizationId || undefined,
          },
        },
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Check if user is admin or owner
    const membership = user.teamMemberships.find(
      (m) => m.organizationId === user.currentOrganizationId
    );

    if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'OWNER')) {
      return NextResponse.json(
        { error: 'Only admins can recalculate storage' },
        { status: 403 }
      );
    }

    const organizationId = user.currentOrganizationId;

    // Recalculate storage
    const storageGB = await updateOrganizationStorageUsage(organizationId);

    // Get updated limits
    const limitCheck = await checkStorageLimit(organizationId);

    return NextResponse.json({
      success: true,
      storageGB,
      limits: limitCheck,
      message: 'Storage usage recalculated successfully',
    });
  } catch (error: unknown) {
    console.error('Error recalculating storage:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate storage' },
      { status: 500 }
    );
  }
}
