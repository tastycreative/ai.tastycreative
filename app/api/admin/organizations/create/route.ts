import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdminAccess } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    // Check super admin access
    await requireSuperAdminAccess();

    const body = await req.json();
    const { name, slug, ownerId, subscriptionPlanId } = body;

    if (!name || !slug || !ownerId) {
      return NextResponse.json(
        { error: 'Name, slug, and ownerId are required' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 400 }
      );
    }

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner user not found' },
        { status: 404 }
      );
    }

    // Create organization and add owner as team member in a transaction
    const organization = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name,
          slug,
          subscriptionPlanId,
          subscriptionStatus: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        },
      });

      await tx.teamMember.create({
        data: {
          userId: ownerId,
          organizationId: newOrg.id,
          role: 'OWNER',
          canInviteMembers: true,
          canManageBilling: true,
          canManageMembers: true,
        },
      });

      // Set as owner's current organization if they don't have one
      if (!owner.currentOrganizationId) {
        await tx.user.update({
          where: { id: ownerId },
          data: { currentOrganizationId: newOrg.id },
        });
      }

      return newOrg;
    });

    return NextResponse.json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
