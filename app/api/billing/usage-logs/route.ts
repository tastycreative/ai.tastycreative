import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
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

    // Get filter parameters from query string
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const feature = searchParams.get('feature');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Build where clause
    const where: any = {
      organizationId: user.currentOrganizationId,
    };

    // Feature filter
    if (feature && feature !== 'all') {
      where.resource = feature;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.creditUsageLog.count({ where });

    // Fetch credit usage logs with pagination
    const creditUsageLogs = await prisma.creditUsageLog.findMany({
      where,
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
      skip: (page - 1) * limit,
      take: limit,
    });

    // Client-side search filter
    let filteredLogs = creditUsageLogs;
    let filteredCount = totalCount;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = creditUsageLogs.filter(log =>
        log.resource.toLowerCase().includes(searchLower) ||
        (log.metadata?.featureName && log.metadata.featureName.toLowerCase().includes(searchLower)) ||
        log.user?.firstName?.toLowerCase().includes(searchLower) ||
        log.user?.lastName?.toLowerCase().includes(searchLower) ||
        log.user?.email?.toLowerCase().includes(searchLower)
      );
      filteredCount = filteredLogs.length;
    }

    return NextResponse.json({
      usageLogs: filteredLogs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        creditsUsed: log.creditsUsed,
        createdAt: log.createdAt.toISOString(),
        metadata: log.metadata,
        user: log.user,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredCount / limit),
        totalItems: filteredCount,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage logs' },
      { status: 500 }
    );
  }
}
