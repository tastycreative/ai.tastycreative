import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

// GET /api/admin/organizations/[id]/permissions - Get organization permissions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;

    // Get organization with plan
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptionPlan: {
          include: {
            planFeatures: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get custom permissions (overrides)
    const customPermissions = await prisma.customOrganizationPermission.findUnique({
      where: { organizationId },
    });

    // Build permissions from plan features
    const planPermissions: Record<string, any> = {};
    if (organization.subscriptionPlan?.planFeatures) {
      for (const feature of organization.subscriptionPlan.planFeatures) {
        // Convert string values to appropriate types
        let value: any = feature.featureValue;
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value === 'unlimited') value = null; // null means unlimited
        else if (!isNaN(Number(value))) value = Number(value);

        planPermissions[feature.featureKey] = value;
      }
    }

    // Merge plan permissions with custom overrides
    const permissions = {
      id: customPermissions?.id || '',
      organizationId,
      ...planPermissions,
      ...(customPermissions || {}),
      // Add plan info for reference
      _planName: organization.subscriptionPlan?.displayName || 'No Plan',
      _canCustomize: true, // Admins can always customize
    };

    return NextResponse.json({
      success: true,
      permissions,
    });
  } catch (error) {
    console.error('Error fetching organization permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization permissions' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/organizations/[id]/permissions - Update organization permissions
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is admin
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;
    const body = await req.json();

    // Remove metadata fields that shouldn't be saved
    const { _planName, _canCustomize, id: _id, createdAt, updatedAt, ...permissionsToSave } = body;

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Update or create custom permissions (these override plan defaults)
    const permissions = await prisma.customOrganizationPermission.upsert({
      where: { organizationId },
      update: permissionsToSave,
      create: {
        organizationId,
        ...permissionsToSave,
      },
    });

    return NextResponse.json({
      success: true,
      permissions,
      message: 'Custom permissions saved. These will override the plan defaults.',
    });
  } catch (error) {
    console.error('Error updating organization permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update organization permissions' },
      { status: 500 }
    );
  }
}
