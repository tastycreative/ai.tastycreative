import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';


export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create the user in the database
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        currentOrganizationId: true,
      },
    });

    // If user doesn't exist in database, create them (new signup)
    if (!user) {
      const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      });

      if (clerkUser.ok) {
        const clerkData = await clerkUser.json();
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            email: clerkData.email_addresses?.[0]?.email_address || '',
            name: `${clerkData.first_name || ''} ${clerkData.last_name || ''}`.trim() || null,
          },
          select: {
            id: true,
            currentOrganizationId: true,
          },
        });
      } else {
        // If we can't fetch from Clerk API, return empty organizations
        return NextResponse.json({
          organizations: [],
          currentOrganization: null,
        });
      }
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
