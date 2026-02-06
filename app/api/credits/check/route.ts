import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        // fetch teamMemberships and their organizations; filter out null organizationIds in application code if needed
        teamMemberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                availableCredits: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Fetch the organization directly using the user's currentOrganizationId
    const currentOrg = await prisma.organization.findUnique({
      where: { id: user.currentOrganizationId },
      select: {
        id: true,
        name: true,
        availableCredits: true,
      },
    });

    if (!currentOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const availableCredits = currentOrg.availableCredits ?? 0;
    const LOW_CREDIT_THRESHOLD = 100; // Warn when below 100 credits

    return NextResponse.json({
      availableCredits,
      organizationName: currentOrg.name,
      organizationId: currentOrg.id,
      isLowCredits: availableCredits > 0 && availableCredits <= LOW_CREDIT_THRESHOLD,
      isOutOfCredits: availableCredits <= 0,
    });
  } catch (error) {
    console.error('Error checking credits:', error);
    return NextResponse.json(
      { error: 'Failed to check credits' },
      { status: 500 }
    );
  }
}
