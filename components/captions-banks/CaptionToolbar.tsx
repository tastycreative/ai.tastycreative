'use client';

import { useMemo } from 'react';
import {
  Search,
  Filter,
  SortAsc,
  Database,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import type { Caption, CaptionFilters } from '@/lib/hooks/useCaptions.query';
import type { Profile as InstagramProfile } from '@/hooks/useInstagramProfile';
import {
  CAPTION_CATEGORIES,
  CAPTION_TYPES,
  CAPTION_BANKS,
  IMPORTED_SHEETS,
  getTopContentTypes,
} from './utils';

interface CaptionToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  sortBy: 'createdAt' | 'postedAt' | 'caption' | 'revenue' | 'performer';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: string) => void;
  sourceFilter: 'all' | 'gallery' | 'imported';
  onSourceFilterChange: (source: 'all' | 'gallery' | 'imported') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedBank: string;
  onBankChange: (bank: string) => void;
  selectedSheet: string;
  onSheetChange: (sheet: string) => void;
  selectedProfileId: string;
  onProfileChange: (profileId: string) => void;
  profiles: InstagramProfile[];
  masterMode: boolean;
  dynamicFilters: CaptionFilters;
  captions: Caption[];
  quickFilterCategories: string[];
  onQuickFilterToggle: (category: string) => void;
}

export function CaptionToolbar({
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  sortBy,
  sortOrder,
  onSortChange,
  sourceFilter,
  onSourceFilterChange,
  viewMode,
  onViewModeChange,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  selectedBank,
  onBankChange,
  selectedSheet,
  onSheetChange,
  selectedProfileId,
  onProfileChange,
  profiles,
  masterMode,
  dynamicFilters,
  captions,
  quickFilterCategories,
  onQuickFilterToggle,
}: CaptionToolbarProps) {
  const categories = dynamicFilters.contentTypes.length > 0 ? dynamicFilters.contentTypes : CAPTION_CATEGORIES;
  const types = dynamicFilters.postOrigins.length > 0 ? dynamicFilters.postOrigins : CAPTION_TYPES;
  const banks = dynamicFilters.platforms.length > 0 ? dynamicFilters.platforms : CAPTION_BANKS;

  const activeFilterCount = [
    selectedCategory !== 'All',
    selectedType !== 'All',
    selectedBank !== 'All',
  ].filter(Boolean).length;

  const topContentTypes = useMemo(() => getTopContentTypes(captions), [captions]);

  return (
    <div className="px-6 sm:px-8 py-4 border-b border-gray-100 dark:border-white/[0.06]">
      {/* Main controls row */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="search captions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-gray-900 dark:text-brand-off-white font-mono text-[13px] py-2.5 pl-9 pr-3 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-brand-light-pink/50 dark:focus:border-brand-light-pink/40"
          />
          {searchQuery && (
            <p className="absolute -bottom-5 left-0 font-mono text-[9px] tracking-[0.05em] text-gray-400 dark:text-gray-600">
              searching caption text, categories, tags, platforms
            </p>
          )}
        </div>

        <button
          onClick={onToggleFilters}
          className={`h-10 px-4 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            showFilters || activeFilterCount > 0
              ? 'bg-brand-light-pink/10 dark:bg-brand-light-pink/15 text-brand-light-pink border border-brand-light-pink/30'
              : 'bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/[0.08] hover:bg-gray-100 dark:hover:bg-white/[0.08]'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 bg-brand-light-pink text-white text-xs rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="relative">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              onSortChange(field, order);
            }}
            className="h-10 pl-3 pr-8 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm font-mono text-gray-600 dark:text-gray-400 appearance-none cursor-pointer focus:outline-none focus:border-brand-light-pink/50"
          >
            <option value="postedAt-desc">Latest Posted</option>
            <option value="postedAt-asc">Earliest Posted</option>
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="revenue-desc">Highest Revenue</option>
            <option value="revenue-asc">Lowest Revenue</option>
            <option value="caption-asc">A to Z</option>
            <option value="caption-desc">Z to A</option>
            <option value="performer-desc">Top Performers</option>
          </select>
          <SortAsc className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex items-center bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg p-0.5">
          <button
            onClick={() => onSourceFilterChange('all')}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-[0.05em] transition-colors ${
              sourceFilter === 'all'
                ? 'bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-brand-off-white'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onSourceFilterChange('gallery')}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-[0.05em] transition-colors flex items-center gap-1 ${
              sourceFilter === 'gallery'
                ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Database className="w-3 h-3" />
            Gallery
          </button>
          <button
            onClick={() => onSourceFilterChange('imported')}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-[0.05em] transition-colors flex items-center gap-1 ${
              sourceFilter === 'imported'
                ? 'bg-white dark:bg-white/10 shadow-sm text-emerald-500'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <FileSpreadsheet className="w-3 h-3" />
            Imported
          </button>
        </div>

        <div className="flex items-center bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 shadow-sm' : ''}`}
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-white/10 shadow-sm' : ''}`}
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick filter chips */}
      {topContentTypes.length > 0 && (
        <div className="mt-3 flex gap-1.5 flex-wrap items-center">
          <span className="font-mono text-[9px] tracking-[0.1em] text-gray-400 dark:text-gray-600 uppercase mr-1">Quick:</span>
          {topContentTypes.map((type) => {
            const isActive = quickFilterCategories.includes(type);
            return (
              <button
                key={type}
                onClick={() => onQuickFilterToggle(type)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-[0.05em] transition-all flex items-center gap-1 ${
                  isActive
                    ? 'bg-brand-light-pink/15 text-brand-light-pink border border-brand-light-pink/30'
                    : 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-500 border border-transparent hover:border-gray-200 dark:hover:border-white/[0.08] hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {type}
                {isActive && <X className="w-2.5 h-2.5" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Active filter chips */}
      {(activeFilterCount > 0 || selectedSheet !== 'All' || quickFilterCategories.length > 0) && (
        <div className="mt-3 flex gap-1.5 flex-wrap items-center">
          <span className="font-mono text-[9px] tracking-[0.1em] text-gray-400 dark:text-gray-600 uppercase mr-1">Active:</span>
          {selectedCategory !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-light-pink/10 text-brand-light-pink text-[10px] font-mono rounded-full border border-brand-light-pink/20">
              {selectedCategory}
              <button onClick={() => onCategoryChange('All')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {selectedType !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-blue/10 text-brand-blue text-[10px] font-mono rounded-full border border-brand-blue/20">
              {selectedType}
              <button onClick={() => onTypeChange('All')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {selectedBank !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-mid-pink/10 text-brand-mid-pink text-[10px] font-mono rounded-full border border-brand-mid-pink/20">
              {selectedBank}
              <button onClick={() => onBankChange('All')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {selectedSheet !== 'All' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-mono rounded-full border border-emerald-500/20">
              {selectedSheet}
              <button onClick={() => onSheetChange('All')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {quickFilterCategories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-light-pink/10 text-brand-light-pink text-[10px] font-mono rounded-full border border-brand-light-pink/20">
              {cat}
              <button onClick={() => onQuickFilterToggle(cat)}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          {(activeFilterCount + (selectedSheet !== 'All' ? 1 : 0) + quickFilterCategories.length) >= 2 && (
            <button
              onClick={() => {
                onCategoryChange('All');
                onTypeChange('All');
                onBankChange('All');
                onSheetChange('All');
                quickFilterCategories.forEach((cat) => onQuickFilterToggle(cat));
              }}
              className="text-[10px] font-mono text-brand-light-pink hover:text-brand-mid-pink transition-colors tracking-wide ml-1"
            >
              clear all
            </button>
          )}
        </div>
      )}

      {/* Expanded Filters */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
          <div className={`grid grid-cols-1 gap-4 ${sourceFilter === 'imported' ? 'sm:grid-cols-5' : masterMode ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            {masterMode && (
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Profile</label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => onProfileChange(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
                >
                  <option value="all">All Profiles</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Content Type</label>
              <select
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
              >
                <option value="All">All Content Types</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Post Origin</label>
              <select
                value={selectedType}
                onChange={(e) => onTypeChange(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
              >
                <option value="All">All Post Origins</option>
                {types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.12em] text-gray-500 dark:text-gray-500 uppercase mb-2">Platform</label>
              <select
                value={selectedBank}
                onChange={(e) => onBankChange(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-brand-light-pink/50"
              >
                <option value="All">All Platforms</option>
                {banks.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            {sourceFilter === 'imported' && (
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] text-emerald-500 dark:text-emerald-400 uppercase mb-2">Sheet</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => onSheetChange(e.target.value)}
                  className="w-full h-10 px-3 bg-emerald-500/5 dark:bg-emerald-500/[0.06] border border-emerald-500/20 dark:border-emerald-500/15 rounded-lg text-sm text-gray-900 dark:text-brand-off-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="All">All Sheets</option>
                  {IMPORTED_SHEETS.map((sheet) => (
                    <option key={sheet} value={sheet}>{sheet}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
