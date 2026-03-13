'use client';

import { useState } from 'react';
import { Users, UserPlus, Activity, TrendingUp, Calendar, Clock } from 'lucide-react';
import {
  useMemberAnalytics,
  type TimeRange,
  type RecentMember,
} from '@/lib/hooks/useAdminAnalytics.query';
import AnalyticsStatsCard from './analytics/AnalyticsStatsCard';
import TimeRangeFilter from './analytics/TimeRangeFilter';
import { AnalyticsAreaChart, AnalyticsBarChart } from './analytics/AnalyticsChart';
import RecentActivityTable, { type TableColumn } from './analytics/RecentActivityTable';

function getMemberName(user: RecentMember['user']) {
  if (user.name) return user.name;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.firstName || user.lastName || 'Anonymous';
}

function ActiveTodayCompact({ members, loading }: { members: RecentMember[]; loading: boolean }) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Active Today</h4>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
          {loading ? '...' : members.length}
        </span>
      </div>
      {loading ? (
        <div className="p-3 space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-foreground/10" />
              <div className="h-3 flex-1 bg-foreground/10 rounded" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground">No members active today</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[280px] divide-y divide-border/50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#EC67A1]/5 transition-colors">
              <div className="relative flex-shrink-0">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center">
                  {m.user.imageUrl ? (
                    <img src={m.user.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 border border-card rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{getMemberName(m.user)}</p>
              </div>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {m.lastLoginAt
                  ? new Date(m.lastLoginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const recentMembersColumns: TableColumn<RecentMember>[] = [
  {
    key: 'user',
    label: 'Member',
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-[#EC67A1] to-[#F774B9] flex items-center justify-center flex-shrink-0">
          {item.user.imageUrl ? (
            <img src={item.user.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users className="w-3.5 h-3.5 text-white" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground text-xs">
            {getMemberName(item.user)}
          </p>
          <p className="text-[10px] text-muted-foreground">{item.user.email || 'No email'}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    render: (item) => (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#5DC3F8]/15 text-[#5DC3F8]">
        {item.role}
      </span>
    ),
  },
  {
    key: 'joinedAt',
    label: 'Joined',
    render: (item) => new Date(item.joinedAt).toLocaleDateString(),
  },
  {
    key: 'lastLoginAt',
    label: 'Last Active',
    render: (item) =>
      item.lastLoginAt
        ? new Date(item.lastLoginAt).toLocaleDateString()
        : 'Never',
  },
];

interface MemberAnalyticsDashboardProps {
  tenant: string;
}

export default function MemberAnalyticsDashboard({ tenant }: MemberAnalyticsDashboardProps) {
  const [range, setRange] = useState<TimeRange>('30d');
  const { data, isLoading } = useMemberAnalytics(range, tenant);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base xs:text-lg sm:text-xl font-semibold text-foreground">Member Analytics</h3>
          {data?.organizationName && (
            <p className="text-xs text-muted-foreground mt-0.5">{data.organizationName}</p>
          )}
        </div>
        <TimeRangeFilter value={range} onChange={setRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <AnalyticsStatsCard
          title="Total Members"
          value={data?.summary.totalMembers ?? 0}
          icon={Users}
          color="pink"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="Active Today"
          value={data?.summary.activeMembersToday ?? 0}
          icon={Activity}
          color="blue"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="New (7d)"
          value={data?.summary.newMembers7d ?? 0}
          icon={UserPlus}
          color="green"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="Active (7d)"
          value={data?.summary.activeMembers7d ?? 0}
          icon={TrendingUp}
          color="purple"
          subtitle="Weekly active members"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="New (30d)"
          value={data?.summary.newMembers30d ?? 0}
          icon={Calendar}
          color="orange"
          loading={isLoading}
        />
        <AnalyticsStatsCard
          title="Active (30d)"
          value={data?.summary.activeMembers30d ?? 0}
          icon={Clock}
          color="blue"
          subtitle="Monthly active members"
          loading={isLoading}
        />
      </div>

      {/* Activity Trends + Active Today (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AnalyticsAreaChart
            data={data?.activityTimeSeries ?? []}
            xKey="date"
            yKey="activeMembers"
            title="Activity Trends"
            color="#5DC3F8"
            loading={isLoading}
          />
        </div>
        <ActiveTodayCompact
          members={data?.activeTodayMembers ?? []}
          loading={isLoading}
        />
      </div>

      {/* Member Growth + Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnalyticsAreaChart
          data={data?.memberGrowthTimeSeries ?? []}
          xKey="date"
          yKey="count"
          title="Member Growth"
          color="#EC67A1"
          loading={isLoading}
        />
        <AnalyticsBarChart
          data={
            data?.membersByRole.map((r) => ({
              name: r.role,
              value: r.count,
            })) ?? []
          }
          title="Members by Role"
          loading={isLoading}
        />
      </div>

      {/* Recent Members */}
      <RecentActivityTable
        title="Recent Members"
        columns={recentMembersColumns}
        data={data?.recentMembers ?? []}
        loading={isLoading}
        emptyMessage="No recent members"
      />
    </div>
  );
}
