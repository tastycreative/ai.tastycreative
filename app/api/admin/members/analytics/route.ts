import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/adminAuth';
import { prisma } from '@/lib/database';

function getDateRange(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAccess();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const slug = searchParams.get('slug');
    const rangeDate = getDateRange(range);

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
    }

    // Resolve slug to organization
    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgFilter = { organizationId: organization.id };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // For activity stats, use user.lastLoginAt via a join since
    // TeamMember.lastActiveAt is only updated on org switch
    const [
      totalMembers,
      newMembers7d,
      newMembers30d,
      membersByRole,
      recentMembers,
    ] = await Promise.all([
      prisma.teamMember.count({ where: orgFilter }),
      prisma.teamMember.count({ where: { ...orgFilter, joinedAt: { gte: sevenDaysAgo } } }),
      prisma.teamMember.count({ where: { ...orgFilter, joinedAt: { gte: thirtyDaysAgo } } }),
      prisma.teamMember.groupBy({
        by: ['role'],
        where: orgFilter,
        _count: { role: true },
      }),
      prisma.teamMember.findMany({
        where: orgFilter,
        take: 10,
        orderBy: { joinedAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
        },
      }),
    ]);

    // Active members via UserDailyActivity (accurate historical tracking)
    const [activeMembersToday, activeMembers7d, activeMembers30d, activeTodayMembers] = await Promise.all([
      prisma.teamMember.count({
        where: { ...orgFilter, user: { dailyActivities: { some: { date: { gte: todayStart } } } } },
      }),
      prisma.teamMember.count({
        where: { ...orgFilter, user: { dailyActivities: { some: { date: { gte: sevenDaysAgo } } } } },
      }),
      prisma.teamMember.count({
        where: { ...orgFilter, user: { dailyActivities: { some: { date: { gte: thirtyDaysAgo } } } } },
      }),
      prisma.teamMember.findMany({
        where: { ...orgFilter, user: { dailyActivities: { some: { date: { gte: todayStart } } } } },
        orderBy: { lastActiveAt: 'desc' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
        },
      }),
    ]);

    // Member growth time series
    const timeSeriesStart = rangeDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const members = await prisma.teamMember.findMany({
      where: {
        ...orgFilter,
        joinedAt: { gte: timeSeriesStart },
      },
      select: { joinedAt: true },
      orderBy: { joinedAt: 'asc' },
    });

    const growthMap = new Map<string, number>();
    members.forEach((m) => {
      const date = m.joinedAt.toISOString().split('T')[0];
      growthMap.set(date, (growthMap.get(date) || 0) + 1);
    });

    const memberGrowthTimeSeries: { date: string; count: number }[] = [];
    const current = new Date(timeSeriesStart);
    while (current <= now) {
      const dateStr = current.toISOString().split('T')[0];
      memberGrowthTimeSeries.push({ date: dateStr, count: growthMap.get(dateStr) || 0 });
      current.setDate(current.getDate() + 1);
    }

    // Activity time series using UserDailyActivity (accurate historical data)
    // Get all member userIds for this org
    const orgMemberIds = await prisma.teamMember.findMany({
      where: orgFilter,
      select: { userId: true },
    });
    const memberUserIds = orgMemberIds.map((m) => m.userId);

    const memberDailyActivities = await prisma.userDailyActivity.groupBy({
      by: ['date'],
      where: {
        userId: { in: memberUserIds },
        date: { gte: timeSeriesStart },
      },
      _count: { userId: true },
      orderBy: { date: 'asc' },
    });

    const activityMap = new Map<string, number>();
    memberDailyActivities.forEach((d) => {
      const dateStr = d.date.toISOString().split('T')[0];
      activityMap.set(dateStr, d._count.userId);
    });

    const activityTimeSeries: { date: string; activeMembers: number }[] = [];
    const actCurrent = new Date(timeSeriesStart);
    while (actCurrent <= now) {
      const dateStr = actCurrent.toISOString().split('T')[0];
      activityTimeSeries.push({ date: dateStr, activeMembers: activityMap.get(dateStr) || 0 });
      actCurrent.setDate(actCurrent.getDate() + 1);
    }

    return NextResponse.json({
      organizationName: organization.name,
      summary: {
        totalMembers,
        activeMembersToday,
        activeMembers7d,
        activeMembers30d,
        newMembers7d,
        newMembers30d,
      },
      membersByRole: membersByRole.map((r) => ({
        role: r.role,
        count: r._count.role,
      })),
      memberGrowthTimeSeries,
      activityTimeSeries,
      recentMembers: recentMembers.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        lastActiveAt: m.lastActiveAt,
        user: {
          name: m.user.name,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          imageUrl: m.user.imageUrl,
        },
      })),
      activeTodayMembers: activeTodayMembers.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        lastActiveAt: m.lastActiveAt,
        user: {
          name: m.user.name,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          imageUrl: m.user.imageUrl,
        },
      })),
    });
  } catch (error: any) {
    console.error('Error fetching member analytics:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch member analytics' }, { status: 500 });
  }
}
