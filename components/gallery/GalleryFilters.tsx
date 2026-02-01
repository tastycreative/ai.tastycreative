'use client';

import React from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import {
  GALLERY_CONTENT_TYPES,
  GALLERY_PLATFORMS,
  CONTENT_TYPE_LABELS,
  PLATFORM_LABELS,
  type GalleryContentType,
  type GalleryPlatform,
} from '@/lib/constants/gallery';

export interface GalleryFilterValues {
  search: string;
  contentType: string;
  platform: string;
  modelId: string;
  isArchived: boolean;
  sortField: string;
  sortOrder: 'asc' | 'desc';
}

interface GalleryFiltersProps {
  filters: GalleryFilterValues;
  onFiltersChange: (filters: Partial<GalleryFilterValues>) => void;
  models?: { id: string; name: string; displayName: string }[];
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
}

export function GalleryFilters({
  filters,
  onFiltersChange,
  models = [],
  showAdvanced = false,
  onToggleAdvanced,
}: GalleryFiltersProps) {
  const hasActiveFilters =
    filters.contentType !== 'all' ||
    filters.platform !== 'all' ||
    filters.modelId !== '' ||
    filters.isArchived;

  return (
    <div className="space-y-4">
      {/* Main Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-lg group">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              placeholder="Search gallery..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-zinc-900/80 border border-zinc-800/50 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:bg-zinc-900 transition-all duration-300"
            />
            {filters.search && (
              <button
                onClick={() => onFiltersChange({ search: '' })}
                className="absolute right-4 p-1 rounded-full hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          {/* Content Type */}
          <select
            value={filters.contentType}
            onChange={(e) => onFiltersChange({ contentType: e.target.value })}
            className="px-4 py-3 bg-zinc-900/80 border border-zinc-800/50 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="all">All Types</option>
            {GALLERY_CONTENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONTENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          {/* Platform */}
          <select
            value={filters.platform}
            onChange={(e) => onFiltersChange({ platform: e.target.value })}
            className="px-4 py-3 bg-zinc-900/80 border border-zinc-800/50 rounded-xl text-zinc-300 focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer min-w-[120px]"
          >
            <option value="all">All Platforms</option>
            {GALLERY_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABELS[platform]}
              </option>
            ))}
          </select>

          {/* Advanced Toggle */}
          <button
            onClick={onToggleAdvanced}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 ${
              showAdvanced || hasActiveFilters
                ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                : 'bg-zinc-900/80 border-zinc-800/50 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">More</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-violet-400" />
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Model Filter */}
            <div>
              <label className="block text-sm text-zinc-500 mb-2">Creator</label>
              <select
                value={filters.modelId}
                onChange={(e) => onFiltersChange({ modelId: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-300 focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="">All Creators</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName || model.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Field */}
            <div>
              <label className="block text-sm text-zinc-500 mb-2">Sort By</label>
              <select
                value={filters.sortField}
                onChange={(e) => onFiltersChange({ sortField: e.target.value })}
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-300 focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="postedAt">Posted Date</option>
                <option value="revenue">Revenue</option>
                <option value="salesCount">Sales</option>
                <option value="viewCount">Views</option>
                <option value="createdAt">Created Date</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm text-zinc-500 mb-2">Order</label>
              <select
                value={filters.sortOrder}
                onChange={(e) =>
                  onFiltersChange({ sortOrder: e.target.value as 'asc' | 'desc' })
                }
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-300 focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>

            {/* Archive Toggle */}
            <div>
              <label className="block text-sm text-zinc-500 mb-2">Status</label>
              <div className="flex gap-2">
                <button
                  onClick={() => onFiltersChange({ isArchived: false })}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    !filters.isArchived
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:text-zinc-400'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => onFiltersChange({ isArchived: true })}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    filters.isArchived
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:text-zinc-400'
                  }`}
                >
                  Archived
                </button>
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-zinc-800/50">
              <button
                onClick={() =>
                  onFiltersChange({
                    contentType: 'all',
                    platform: 'all',
                    modelId: '',
                    isArchived: false,
                  })
                }
                className="text-sm text-zinc-500 hover:text-violet-400 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
