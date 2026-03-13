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
    const rangeDate = getDateRange(range);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch summary stats
    const [
      totalUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      dau,
      wau,
      mau,
      roleDistribution,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      // DAU/WAU/MAU: count distinct users from UserDailyActivity
      prisma.userDailyActivity.groupBy({ by: ['userId'], where: { date: { gte: todayStart } } }).then(r => r.length),
      prisma.userDailyActivity.groupBy({ by: ['userId'], where: { date: { gte: sevenDaysAgo } } }).then(r => r.length),
      prisma.userDailyActivity.groupBy({ by: ['userId'], where: { date: { gte: thirtyDaysAgo } } }).then(r => r.length),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          createdAt: true,
          role: true,
        },
      }),
    ]);

    // Growth rate calculations
    const previousPeriodStart7d = new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousPeriodStart30d = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [prevNewUsers7d, prevNewUsers30d] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: previousPeriodStart7d, lt: sevenDaysAgo } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: previousPeriodStart30d, lt: thirtyDaysAgo } },
      }),
    ]);

    const growthRate7d = prevNewUsers7d > 0
      ? ((newUsers7d - prevNewUsers7d) / prevNewUsers7d) * 100
      : newUsers7d > 0 ? 100 : 0;

    const growthRate30d = prevNewUsers30d > 0
      ? ((newUsers30d - prevNewUsers30d) / prevNewUsers30d) * 100
      : newUsers30d > 0 ? 100 : 0;

    // Time series data - signup growth
    const timeSeriesStart = rangeDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: timeSeriesStart } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const signupMap = new Map<string, number>();
    users.forEach((u) => {
      const date = u.createdAt.toISOString().split('T')[0];
      signupMap.set(date, (signupMap.get(date) || 0) + 1);
    });

    // Fill in missing dates
    const signupTimeSeries: { date: string; count: number }[] = [];
    const current = new Date(timeSeriesStart);
    while (current <= now) {
      const dateStr = current.toISOString().split('T')[0];
      signupTimeSeries.push({ date: dateStr, count: signupMap.get(dateStr) || 0 });
      current.setDate(current.getDate() + 1);
    }

    // Activity time series from UserDailyActivity (accurate historical data)
    const dailyActivities = await prisma.userDailyActivity.groupBy({
      by: ['date'],
      where: { date: { gte: timeSeriesStart } },
      _count: { userId: true },
      orderBy: { date: 'asc' },
    });

    const activityMap = new Map<string, number>();
    dailyActivities.forEach((d) => {
      const dateStr = d.date.toISOString().split('T')[0];
      activityMap.set(dateStr, d._count.userId);
    });

    const activityTimeSeries: { date: string; activeUsers: number }[] = [];
    const actCurrent = new Date(timeSeriesStart);
    while (actCurrent <= now) {
      const dateStr = actCurrent.toISOString().split('T')[0];
      activityTimeSeries.push({ date: dateStr, activeUsers: activityMap.get(dateStr) || 0 });
      actCurrent.setDate(actCurrent.getDate() + 1);
    }

    return NextResponse.json({
      summary: {
        totalUsers,
        newUsersToday,
        newUsers7d,
        newUsers30d,
        dau,
        wau,
        mau,
        growthRate7d: Math.round(growthRate7d * 10) / 10,
        growthRate30d: Math.round(growthRate30d * 10) / 10,
      },
      signupTimeSeries,
      activityTimeSeries,
      roleDistribution: roleDistribution.map((r) => ({
        role: r.role,
        count: r._count.role,
      })),
      recentSignups,
    });
  } catch (error: any) {
    console.error('Error fetching user analytics:', error);

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch user analytics' }, { status: 500 });
  }
}
