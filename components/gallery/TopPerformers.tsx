'use client';

import React from 'react';
import { Trophy, TrendingUp, ImageIcon, DollarSign } from 'lucide-react';

interface ModelStats {
  model: {
    id: string;
    name: string;
    displayName: string;
    profileImageUrl: string | null;
  } | null;
  count: number;
  revenue: number;
  salesCount: number;
}

interface TopPerformersProps {
  modelStats: ModelStats[];
  loading?: boolean;
  sortBy?: 'count' | 'revenue';
  onSortChange?: (sort: 'count' | 'revenue') => void;
}

export function TopPerformers({
  modelStats,
  loading = false,
  sortBy = 'count',
  onSortChange
}: TopPerformersProps) {
  // Sort models based on selected criteria
  const sortedModels = [...modelStats].sort((a, b) => {
    if (sortBy === 'revenue') {
      return b.revenue - a.revenue;
    }
    return b.count - a.count;
  }).slice(0, 10);

  if (loading) {
    return (
      <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-medium text-white">Top Performers</h3>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-zinc-800" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-zinc-800 rounded mb-2" />
                <div className="h-3 w-16 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sortedModels.length === 0) {
    return (
      <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-medium text-white">Top Performers</h3>
        </div>
        <p className="text-zinc-500 text-sm text-center py-8">
          No model data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-medium text-white">Top Performers</h3>
        </div>

        {/* Sort Toggle */}
        {onSortChange && (
          <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
            <button
              onClick={() => onSortChange('count')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortBy === 'count'
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Content
            </button>
            <button
              onClick={() => onSortChange('revenue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sortBy === 'revenue'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Revenue
            </button>
          </div>
        )}
      </div>

      {/* Model List */}
      <div className="space-y-3">
        {sortedModels.map((stat, index) => {
          const model = stat.model;
          const displayName = model?.displayName || model?.name || 'Unknown';
          const initial = displayName.charAt(0).toUpperCase();

          // Determine rank styling
          const rankStyles = {
            0: 'bg-gradient-to-br from-amber-400 to-amber-600 text-black',
            1: 'bg-gradient-to-br from-zinc-300 to-zinc-500 text-black',
            2: 'bg-gradient-to-br from-amber-600 to-amber-800 text-white',
          }[index] || 'bg-zinc-800 text-zinc-400';

          return (
            <div
              key={model?.id || index}
              className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors group"
            >
              {/* Rank */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${rankStyles}`}>
                {index + 1}
              </div>

              {/* Avatar */}
              {model?.profileImageUrl ? (
                <img
                  src={model.profileImageUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700 group-hover:border-zinc-600 transition-colors"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-zinc-700 flex items-center justify-center text-violet-400 font-medium">
                  {initial}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{displayName}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">
                    <span className="text-zinc-300">{stat.count}</span> items
                  </span>
                  {stat.revenue > 0 && (
                    <span className="text-zinc-500">
                      <span className="text-emerald-400">${stat.revenue.toLocaleString()}</span> revenue
                    </span>
                  )}
                </div>
              </div>

              {/* Metric Highlight */}
              <div className="text-right">
                {sortBy === 'revenue' ? (
                  <div className="flex items-center gap-1 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-semibold">${stat.revenue.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-violet-400">
                    <ImageIcon className="w-4 h-4" />
                    <span className="font-semibold">{stat.count}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
