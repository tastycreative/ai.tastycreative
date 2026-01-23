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
        subscriptionPlan: {
          include: {
            planFeatures: true,
          },
        },
        customPermissions: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Build permissions map
    const planPermissions: Record<string, any> = {};
    if (organization.subscriptionPlan?.planFeatures) {
      for (const feature of organization.subscriptionPlan.planFeatures) {
        let value: any = feature.featureValue;
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value === 'unlimited') value = null;
        else if (!isNaN(Number(value))) value = Number(value);

        planPermissions[feature.featureKey] = value;
      }
    }

    return NextResponse.json({
      organizationName: organization.name,
      planName: organization.subscriptionPlan?.displayName || 'No Plan',
      planFeatures: planPermissions,
      customPermissions: organization.customPermissions,
      finalPermissions: {
        ...planPermissions,
        ...(organization.customPermissions || {}),
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}
