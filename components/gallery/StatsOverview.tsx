'use client';

import React from 'react';
import { DollarSign, ShoppingCart, Eye, ImageIcon, TrendingUp, BarChart3 } from 'lucide-react';

interface GalleryStats {
  totals: {
    itemCount: number;
    totalRevenue: number;
    totalSales: number;
    totalViews: number;
    averageRevenue: number;
    averageConversionRate: number;
  };
  byContentType: {
    contentType: string;
    count: number;
    revenue: number;
    salesCount: number;
  }[];
  byPlatform: {
    platform: string;
    count: number;
    revenue: number;
    salesCount: number;
  }[];
}

interface StatsOverviewProps {
  stats: GalleryStats | null;
  loading?: boolean;
}

export function StatsOverview({ stats, loading = false }: StatsOverviewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-pulse"
          >
            <div className="h-5 w-20 bg-zinc-800 rounded mb-3" />
            <div className="h-8 w-24 bg-zinc-800 rounded mb-2" />
            <div className="h-4 w-16 bg-zinc-800/50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: 'Total Content',
      value: stats.totals.itemCount.toLocaleString(),
      subValue: 'items',
      icon: ImageIcon,
      color: 'from-violet-500/20 to-fuchsia-500/20',
      iconColor: 'text-violet-400',
    },
    {
      label: 'Total Revenue',
      value: `$${stats.totals.totalRevenue.toLocaleString()}`,
      subValue: `$${stats.totals.averageRevenue.toFixed(2)} avg`,
      icon: DollarSign,
      color: 'from-emerald-500/20 to-green-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Total Sales',
      value: stats.totals.totalSales.toLocaleString(),
      subValue: 'purchases',
      icon: ShoppingCart,
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Total Views',
      value: stats.totals.totalViews.toLocaleString(),
      subValue: `${stats.totals.averageConversionRate.toFixed(1)}% conv`,
      icon: Eye,
      color: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="group relative p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-zinc-700/50 transition-all duration-300 overflow-hidden"
          >
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-500">{card.label}</span>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <p className="text-2xl font-semibold text-white mb-1">{card.value}</p>
              <p className="text-xs text-zinc-500">{card.subValue}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Content Type */}
        <div className="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-medium text-zinc-400">Revenue by Content Type</h3>
          </div>
          <div className="space-y-3">
            {stats.byContentType.slice(0, 5).map((item) => {
              const percentage = stats.totals.totalRevenue > 0
                ? (item.revenue / stats.totals.totalRevenue) * 100
                : 0;
              return (
                <div key={item.contentType} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{item.contentType.replace(/_/g, ' ')}</span>
                    <span className="text-emerald-400 font-medium">${item.revenue.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Platform */}
        <div className="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-medium text-zinc-400">Revenue by Platform</h3>
          </div>
          <div className="space-y-3">
            {stats.byPlatform.map((item) => {
              const percentage = stats.totals.totalRevenue > 0
                ? (item.revenue / stats.totals.totalRevenue) * 100
                : 0;
              return (
                <div key={item.platform} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{item.platform}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">{item.count} items</span>
                      <span className="text-emerald-400 font-medium">${item.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
