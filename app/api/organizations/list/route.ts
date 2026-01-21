import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';


export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user from the database
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

    // Get all organizations the user is a member of
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            subscriptionStatus: true,
            subscriptionPlanId: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    // Transform to the format expected by the frontend
    const organizations = teamMemberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      logoUrl: membership.organization.logoUrl,
      subscriptionStatus: membership.organization.subscriptionStatus,
      role: membership.role,
    }));

    // Get current organization details
    let currentOrganization = null;
    if (user.currentOrganizationId) {
      const currentMembership = teamMemberships.find(
        (m) => m.organization.id === user.currentOrganizationId
      );

      if (currentMembership) {
        currentOrganization = {
          id: currentMembership.organization.id,
          name: currentMembership.organization.name,
          slug: currentMembership.organization.slug,
          logoUrl: currentMembership.organization.logoUrl,
          subscriptionStatus: currentMembership.organization.subscriptionStatus,
          role: currentMembership.role,
        };
      }
    }

    // If no current organization is set but user has organizations, set the first one
    if (!currentOrganization && organizations.length > 0) {
      currentOrganization = organizations[0];
      // Update user's currentOrganizationId
      await prisma.user.update({
        where: { id: user.id },
        data: { currentOrganizationId: organizations[0].id },
      });
    }

    return NextResponse.json({
      organizations,
      currentOrganization,
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
