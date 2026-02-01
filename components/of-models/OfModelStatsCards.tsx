'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, Users, DollarSign, Sparkles, Clock } from 'lucide-react';

export type StatsColorType = 'primary' | 'success' | 'warning' | 'info';

interface StatsColorConfig {
  gradient: string;
  iconBg: string;
  iconColor: string;
}

const colorConfigs: Record<StatsColorType, StatsColorConfig> = {
  primary: {
    gradient: 'from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
  },
  success: {
    gradient: 'from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
  warning: {
    gradient: 'from-amber-500 to-orange-600 dark:from-amber-400 dark:to-orange-400',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
  },
  info: {
    gradient: 'from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
};

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: React.ComponentType<{ className?: string }>;
  color: StatsColorType;
  progressPercent?: number;
  progressLabel?: string;
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  color,
  progressPercent,
  progressLabel,
  loading,
}: StatsCardProps) {
  const config = colorConfigs[color];

  if (loading) {
    return (
      <div className="relative group p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-xl">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('p-3 rounded-xl', config.iconBg)}>
            <div className="w-5 h-5 bg-zinc-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative group p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-xl hover:border-zinc-700/50 transition-all duration-300 hover:-translate-y-0.5">
      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-violet-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              'p-3 rounded-xl transition-transform duration-300 group-hover:scale-110',
              config.iconBg
            )}
          >
            <Icon className={cn('w-5 h-5', config.iconColor)} />
          </div>
          {change && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md',
                change.type === 'increase'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              )}
            >
              <TrendingUp
                className={cn('w-3 h-3', change.type === 'decrease' && 'rotate-180')}
              />
              {change.value}%
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            {title}
          </h3>
          <p
            className={cn(
              'text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent',
              config.gradient
            )}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>

        {progressPercent !== undefined && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[10px] font-medium text-zinc-500">
              <span>{progressLabel}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r', config.gradient)}
                style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface OfModelStatsData {
  counts: {
    total: number;
    active: number;
    inactive: number;
    dropped: number;
    pending: number;
  };
  totalAssets: number;
  totalGuaranteedRevenue: number;
  recentModelsCount: number;
  highRevenueCount: number;
  recentModels?: Array<{
    id: string;
    name: string;
    displayName: string;
    slug: string;
    status: string;
    profileImageUrl: string | null;
    createdAt: string;
  }>;
}

interface OfModelStatsCardsProps {
  stats: OfModelStatsData | null;
  loading?: boolean;
}

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

export function OfModelStatsCards({ stats, loading }: OfModelStatsCardsProps) {
  const activePercent = stats?.counts.total
    ? Math.round((stats.counts.active / stats.counts.total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatsCard
        title="Total Models"
        value={stats?.counts.total ?? 0}
        icon={Users}
        color="primary"
        loading={loading}
      />
      <StatsCard
        title="Active"
        value={stats?.counts.active ?? 0}
        icon={Sparkles}
        color="success"
        progressPercent={activePercent}
        progressLabel="Active rate"
        loading={loading}
      />
      <StatsCard
        title="Guaranteed Revenue"
        value={stats?.totalGuaranteedRevenue ? `$${formatCompactNumber(stats.totalGuaranteedRevenue)}` : '$0'}
        icon={DollarSign}
        color="warning"
        loading={loading}
      />
      <StatsCard
        title="Recent (30d)"
        value={stats?.recentModelsCount ?? 0}
        icon={Clock}
        color="info"
        loading={loading}
      />
    </div>
  );
}

export default OfModelStatsCards;
