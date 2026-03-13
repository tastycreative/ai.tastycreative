'use client';

import { useState } from 'react';
import { Users, UserPlus, Activity, TrendingUp, Eye, Calendar } from 'lucide-react';
import { useUserAnalytics, type TimeRange, type RecentSignup } from '@/lib/hooks/useAdminAnalytics.query';

function getUserName(item: RecentSignup) {
  if (item.name) return item.name;
  if (item.firstName && item.lastName) return `${item.firstName} ${item.lastName}`;
  return item.firstName || item.lastName || 'Anonymous';
}
import AnalyticsStatsCard from './analytics/AnalyticsStatsCard';
import TimeRangeFilter from './analytics/TimeRangeFilter';
import { AnalyticsAreaChart, AnalyticsPieChart } from './analytics/AnalyticsChart';
import RecentActivityTable, { type TableColumn } from './analytics/RecentActivityTable';

const recentSignupsColumns: TableColumn<RecentSignup>[] = [
  {
    key: 'user',
    label: 'User',
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center flex-shrink-0">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users className="w-3.5 h-3.5 text-white" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground text-xs">
            {getUserName(item)}
          </p>
          <p className="text-[10px] text-muted-foreground">{item.email || 'No email'}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    render: (item) => (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          item.role === 'SUPER_ADMIN'
            ? 'bg-[#EC67A1]/15 text-[#EC67A1]'
            : item.role === 'ADMIN'
            ? 'bg-[#F774B9]/15 text-[#F774B9]'
            : 'bg-accent text-foreground/70'
        }`}
      >
        {item.role}
      </span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Joined',
    render: (item) => new Date(item.createdAt).toLocaleDateString(),
  },
];

export default function UserAnalyticsDashboard() {
  const [range, setRange] = useState<TimeRange>('30d');
  const { data, isLoading } = useUserAnalytics(range);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with time range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-foreground">User Analytics</h3>
        <TimeRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <AnalyticsStatsCard
          title="Total Users"
          value={data?.summary.totalUsers ?? 0}
          icon={Users}
          color="pink"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="New Today"
          value={data?.summary.newUsersToday ?? 0}
          icon={UserPlus}
          color="blue"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="New (7d)"
          value={data?.summary.newUsers7d ?? 0}
          icon={TrendingUp}
          color="green"
          trend={data?.summary.growthRate7d}
          subtitle="vs previous 7 days"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="DAU"
          value={data?.summary.dau ?? 0}
          icon={Activity}
          color="purple"
          subtitle="Daily active users"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="WAU"
          value={data?.summary.wau ?? 0}
          icon={Eye}
          color="orange"
          subtitle="Weekly active users"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="MAU"
          value={data?.summary.mau ?? 0}
          icon={Calendar}
          color="blue"
          subtitle="Monthly active users"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsAreaChart
          data={data?.signupTimeSeries ?? []}
          xKey="date"
          yKey="count"
          title="Signup Growth"
          color="#EC67A1"
          loading={isLoading}
        />
        <AnalyticsAreaChart
          data={data?.activityTimeSeries ?? []}
          xKey="date"
          yKey="activeUsers"
          title="Activity Trends"
          color="#5DC3F8"
          loading={isLoading}
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsPieChart
          data={
            data?.roleDistribution.map((r) => ({
              name: r.role,
              value: r.count,
            })) ?? []
          }
          title="Role Distribution"
          loading={isLoading}
        />
        <RecentActivityTable
          title="Recent Signups"
          columns={recentSignupsColumns}
          data={data?.recentSignups ?? []}
          loading={isLoading}
          emptyMessage="No recent signups"
        />
      </div>
    </div>
  );
}
