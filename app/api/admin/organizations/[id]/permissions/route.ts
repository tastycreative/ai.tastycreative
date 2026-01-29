import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdminAccess } from '@/lib/adminAuth';

// GET /api/admin/organizations/[id]/permissions - Get organization permissions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check super admin access
    await requireSuperAdminAccess();

    const { id: organizationId } = await params;

    // Get organization with plan
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscriptionPlan: true,
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

    // Build permissions from plan features (now stored as JSON)
    const planPermissions: Record<string, any> = {};
    if (organization.subscriptionPlan?.features) {
      const features = typeof organization.subscriptionPlan.features === 'string'
        ? JSON.parse(organization.subscriptionPlan.features)
        : organization.subscriptionPlan.features;

      Object.assign(planPermissions, features);
    }

    // Parse custom permissions from JSON field
    const customPermsData = customPermissions?.permissions
      ? (typeof customPermissions.permissions === 'string'
        ? JSON.parse(customPermissions.permissions)
        : customPermissions.permissions)
      : {};

    // Merge plan permissions with custom overrides
    const permissions = {
      id: customPermissions?.id || '',
      organizationId,
      ...planPermissions,
      ...customPermsData, // JSON permissions override plan defaults
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
    // Check super admin access
    await requireSuperAdminAccess();

    const { id: organizationId } = await params;
    const body = await req.json();

    // Remove metadata fields that shouldn't be saved
    const { _planName, _canCustomize, id: _id, createdAt, updatedAt, organizationId: _orgId, ...permissionsToSave } = body;

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

    // Store permissions as JSON (these override plan defaults)
    const permissions = await prisma.customOrganizationPermission.upsert({
      where: { organizationId },
      update: {
        permissions: permissionsToSave, // Store entire permissions object as JSON
      },
      create: {
        organizationId,
        permissions: permissionsToSave, // Store entire permissions object as JSON
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
