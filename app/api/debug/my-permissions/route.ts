import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.currentOrganizationId) {
      return NextResponse.json({
        message: 'No organization - solo user',
        permissions: 'ALL (DEFAULT_SOLO_PERMISSIONS)'
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
      include: {
        subscriptionPlan: true,
        customPermissions: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Build permissions map (features are now stored as JSON)
    const planPermissions: Record<string, any> = {};
    if (organization.subscriptionPlan?.features) {
      const features = typeof organization.subscriptionPlan.features === 'string'
        ? JSON.parse(organization.subscriptionPlan.features)
        : organization.subscriptionPlan.features;

      Object.assign(planPermissions, features);
    }

    // Parse custom permissions from JSON
    const customPerms = organization.customPermissions?.permissions
      ? (typeof organization.customPermissions.permissions === 'string'
        ? JSON.parse(organization.customPermissions.permissions)
        : organization.customPermissions.permissions)
      : {};

    return NextResponse.json({
      organizationName: organization.name,
      planName: organization.subscriptionPlan?.displayName || 'No Plan',
      planFeatures: planPermissions,
      customPermissions: customPerms,
      finalPermissions: {
        ...planPermissions,
        ...customPerms,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}
