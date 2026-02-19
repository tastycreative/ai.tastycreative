'use client';

import { useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export interface BoardTab {
  id: string;
  label: string;
}

interface BoardLayoutProps {
  spaceName: string;
  templateLabel?: string;
  tabs: BoardTab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  children: (activeTab: string, searchQuery: string) => ReactNode;
}

export function BoardLayout({
  spaceName,
  templateLabel = 'Kanban',
  tabs,
  defaultTab,
  onTabChange,
  children,
}: BoardLayoutProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  return (
    <div className="flex flex-col gap-0">
      {/* ── Space header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-brand-off-white truncate">
            {spaceName}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Plan, track, and manage work across your team.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full bg-brand-dark-pink/10 text-brand-dark-pink px-3 py-1 text-[11px] font-medium">
          {templateLabel} template
        </span>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-brand-mid-pink/20 flex items-center gap-1 -mb-px">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={[
                'relative px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-colors',
                isActive
                  ? 'text-brand-light-pink bg-white/70 dark:bg-gray-900/50'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/30',
              ].join(' ')}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between py-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              filtersOpen
                ? 'border-brand-light-pink/40 bg-brand-light-pink/10 text-brand-light-pink'
                : 'border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 hover:border-brand-light-pink/40',
            ].join(' ')}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
          </button>

          {filtersOpen && (
            <>
              <span className="inline-flex items-center rounded-lg border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                Status: All
              </span>
              <span className="inline-flex items-center rounded-lg border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                Assignee: Any
              </span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="text-[11px] font-medium text-gray-400 hover:text-brand-light-pink transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Content area (rendered by consumer) ───────────────── */}
      <div className="flex-1 min-h-0">
        {children(activeTab, searchQuery)}
      </div>
    </div>
  );
}
