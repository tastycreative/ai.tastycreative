'use client';

import { LucideIcon } from 'lucide-react';

export type CardColor = 'pink' | 'blue' | 'green' | 'purple' | 'orange';

interface AnalyticsStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: CardColor;
  trend?: number;
  subtitle?: string;
  loading?: boolean;
}

const colorMap: Record<CardColor, { bg: string; iconBg: string; text: string; border: string; trendUp: string; trendDown: string }> = {
  pink: {
    bg: 'bg-[#EC67A1]/5 dark:bg-[#EC67A1]/10',
    iconBg: 'bg-gradient-to-br from-[#EC67A1] to-[#F774B9]',
    text: 'text-[#EC67A1]',
    border: 'border-[#EC67A1]/20',
    trendUp: 'text-emerald-500',
    trendDown: 'text-red-500',
  },
  blue: {
    bg: 'bg-[#5DC3F8]/5 dark:bg-[#5DC3F8]/10',
    iconBg: 'bg-gradient-to-br from-[#5DC3F8] to-[#4BA8E0]',
    text: 'text-[#5DC3F8]',
    border: 'border-[#5DC3F8]/20',
    trendUp: 'text-emerald-500',
    trendDown: 'text-red-500',
  },
  green: {
    bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
    text: 'text-emerald-500',
    border: 'border-emerald-500/20',
    trendUp: 'text-emerald-500',
    trendDown: 'text-red-500',
  },
  purple: {
    bg: 'bg-purple-500/5 dark:bg-purple-500/10',
    iconBg: 'bg-gradient-to-br from-purple-400 to-purple-600',
    text: 'text-purple-500',
    border: 'border-purple-500/20',
    trendUp: 'text-emerald-500',
    trendDown: 'text-red-500',
  },
  orange: {
    bg: 'bg-orange-500/5 dark:bg-orange-500/10',
    iconBg: 'bg-gradient-to-br from-orange-400 to-orange-600',
    text: 'text-orange-500',
    border: 'border-orange-500/20',
    trendUp: 'text-emerald-500',
    trendDown: 'text-red-500',
  },
};

export default function AnalyticsStatsCard({
  title,
  value,
  icon: Icon,
  color = 'pink',
  trend,
  subtitle,
  loading = false,
}: AnalyticsStatsCardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 animate-pulse`}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-20 bg-foreground/10 rounded" />
          <div className="w-10 h-10 rounded-lg bg-foreground/10" />
        </div>
        <div className="h-8 w-16 bg-foreground/10 rounded mb-1" />
        <div className="h-3 w-24 bg-foreground/10 rounded" />
      </div>
    );
  }

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={`${colors.iconBg} w-10 h-10 rounded-lg flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-2xl font-bold ${colors.text}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-medium mb-1 ${trend > 0 ? colors.trendUp : colors.trendDown}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
