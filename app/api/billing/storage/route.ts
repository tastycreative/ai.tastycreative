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

    const { searchParams } = new URL(req.url);
    const organizationSlug = searchParams.get('organizationSlug');

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { currentOrganizationId: true },
    });

    let organizationId: string | null = null;

    // If organizationSlug is provided, use it to find the organization
    if (organizationSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        select: { id: true },
      });
      
      if (org) {
        // Verify user is a member of this organization
        const membership = await prisma.teamMember.findFirst({
          where: {
            organizationId: org.id,
            user: { clerkId: userId },
          },
        });
        
        if (membership || user?.currentOrganizationId === org.id) {
          organizationId = org.id;
        }
      }
    }
    
    // Fall back to user's current organization if no valid slug provided
    if (!organizationId) {
      organizationId = user?.currentOrganizationId || null;
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

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

    const { searchParams } = new URL(req.url);
    const organizationSlug = searchParams.get('organizationSlug');

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    let organizationId: string | null = null;

    // If organizationSlug is provided, use it to find the organization
    if (organizationSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        select: { id: true },
      });
      
      if (org) {
        // Verify user is a member of this organization
        const membership = await prisma.teamMember.findFirst({
          where: {
            organizationId: org.id,
            user: { clerkId: userId },
          },
        });
        
        if (membership || user?.currentOrganizationId === org.id) {
          organizationId = org.id;
        }
      }
    }
    
    // Fall back to user's current organization if no valid slug provided
    if (!organizationId) {
      organizationId = user?.currentOrganizationId || null;
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Check if user is admin or owner
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: user!.id,
        organizationId: organizationId,
        role: { in: ['ADMIN', 'OWNER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only admins can recalculate storage' },
        { status: 403 }
      );
    }

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
