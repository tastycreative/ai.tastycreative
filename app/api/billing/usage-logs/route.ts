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
      select: { currentOrganizationId: true },
    });

    if (!user || !user.currentOrganizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    // Fetch credit usage logs for the organization
    const creditUsageLogs = await prisma.creditUsageLog.findMany({
      where: {
        organizationId: user.currentOrganizationId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to most recent 100 entries
    });

    return NextResponse.json({
      usageLogs: creditUsageLogs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        creditsUsed: log.creditsUsed,
        createdAt: log.createdAt.toISOString(),
        metadata: log.metadata,
        user: log.user,
      })),
    });
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage logs' },
      { status: 500 }
    );
  }
}
