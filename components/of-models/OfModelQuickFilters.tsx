'use client';

import { cn } from '@/lib/utils';
import { Sparkles, Clock, DollarSign, Users, XCircle } from 'lucide-react';

export type QuickFilterType = 'all' | 'active' | 'dropped' | 'recent' | 'high-revenue';

interface FilterConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeColor: string;
}

const filterConfigs: Record<QuickFilterType, FilterConfig> = {
  all: {
    label: 'All',
    icon: Users,
    color: 'text-zinc-400',
    activeColor: 'bg-zinc-500/20 border-zinc-500/30 text-zinc-300',
  },
  active: {
    label: 'Active',
    icon: Sparkles,
    color: 'text-emerald-400',
    activeColor: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  },
  dropped: {
    label: 'Dropped',
    icon: XCircle,
    color: 'text-rose-400',
    activeColor: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
  },
  recent: {
    label: 'Recent',
    icon: Clock,
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  },
  'high-revenue': {
    label: 'High Revenue',
    icon: DollarSign,
    color: 'text-amber-400',
    activeColor: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  },
};

interface OfModelQuickFiltersProps {
  activeFilter: QuickFilterType;
  onFilterChange: (filter: QuickFilterType) => void;
  counts: Record<QuickFilterType, number>;
}

export function OfModelQuickFilters({
  activeFilter,
  onFilterChange,
  counts,
}: OfModelQuickFiltersProps) {
  const filters: QuickFilterType[] = ['all', 'active', 'dropped', 'recent', 'high-revenue'];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mr-2">
        Quick Filters:
      </span>
      {filters.map((filter) => {
        const config = filterConfigs[filter];
        const Icon = config.icon;
        const isActive = activeFilter === filter;
        const count = counts[filter] || 0;

        return (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200',
              isActive
                ? config.activeColor
                : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', isActive ? config.color : 'opacity-70')} />
            <span>{config.label}</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-bold',
                isActive
                  ? 'bg-white/10'
                  : 'bg-zinc-800 text-zinc-500'
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Helper functions for filtering
export function isRecentModel(launchDate: string | null, days = 30): boolean {
  if (!launchDate) return false;
  const launch = new Date(launchDate);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return launch >= cutoff;
}

export function isHighRevenueModel(
  guaranteedAmount: number | null | undefined,
  threshold = 1000
): boolean {
  return (guaranteedAmount || 0) > threshold;
}

export default OfModelQuickFilters;
