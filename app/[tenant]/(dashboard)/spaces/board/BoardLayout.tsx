'use client';

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, MoreHorizontal, Settings, ArrowUpDown, User, Columns3, Sparkles, LayoutGrid, BarChart3, FileText, Link2, CalendarDays, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

export interface BoardTab {
  id: string;
  label: string;
}

export type SortOption = 'last-updated' | 'newest' | 'oldest' | 'priority' | 'alphabetical';

export interface BoardFilters {
  searchQuery: string;
  statusFilter: string | null;
  assigneeFilter: string | null;
  priorityFilter: string | null;
  sortBy: SortOption;
  sortAsc: boolean;
  myTasksOnly: boolean;
  hiddenColumns: Set<string>;
}

interface BoardLayoutProps {
  spaceName: string;
  spaceSlug: string;
  userRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  organizationRole?: string;
  onSpaceNameUpdate?: (newName: string) => Promise<void>;
  templateLabel?: string;
  tabs: BoardTab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
  columns?: { id: string; name: string }[];
  assignees?: string[];
  totalTaskCount?: number;
  filteredTaskCount?: number;
  currentUserId?: string;
  children: (activeTab: string, filters: BoardFilters) => ReactNode;
}

export function BoardLayout({
  spaceName,
  spaceSlug,
  userRole,
  organizationRole,
  onSpaceNameUpdate,
  templateLabel = 'Kanban',
  tabs,
  defaultTab,
  onTabChange,
  columns = [],
  assignees = [],
  totalTaskCount = 0,
  filteredTaskCount,
  currentUserId,
  children,
}: BoardLayoutProps) {
  const params = useParams<{ tenant: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-param driven tab: ?tab=calendar, ?tab=board, etc.
  const validTabIds = useMemo(() => new Set(tabs.map((t) => t.id)), [tabs]);
  const urlTab = searchParams.get('tab');
  const activeTab = urlTab && validTabIds.has(urlTab) ? urlTab : (defaultTab ?? tabs[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('last-updated');
  const [sortAsc, setSortAsc] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(spaceName);
  const [isUpdating, setIsUpdating] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Close toolbar dropdowns when clicking outside
  useEffect(() => {
    const anyDropdownOpen = showSortDropdown || filtersOpen || showColumnsDropdown;
    if (!anyDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
        setShowStatusDropdown(false);
        setShowAssigneeDropdown(false);
        setShowPriorityDropdown(false);
        setShowColumnsDropdown(false);
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortDropdown, filtersOpen, showColumnsDropdown]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsMenu]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Update editedName when spaceName prop changes
  useEffect(() => {
    setEditedName(spaceName);
  }, [spaceName]);

  const handleNameClick = () => {
    if (canAccessSettings) {
      setIsEditingName(true);
    }
  };

  const handleNameSave = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === spaceName || !onSpaceNameUpdate) {
      setEditedName(spaceName);
      setIsEditingName(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onSpaceNameUpdate(trimmedName);
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update space name:', error);
      setEditedName(spaceName);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditedName(spaceName);
      setIsEditingName(false);
    }
  };

  const handleTabChange = (tabId: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (tabId === (defaultTab ?? tabs[0]?.id)) {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tabId);
    }
    // Clear event deep-link param when switching tabs
    newParams.delete('event');
    const qs = newParams.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    onTabChange?.(tabId);
  };

  const closeAllDropdowns = () => {
    setShowSortDropdown(false);
    setShowStatusDropdown(false);
    setShowAssigneeDropdown(false);
    setShowPriorityDropdown(false);
    setShowColumnsDropdown(false);
  };

  const clearFilters = () => {
    setStatusFilter(null);
    setAssigneeFilter(null);
    setPriorityFilter(null);
    setMyTasksOnly(false);
    setFiltersOpen(false);
    closeAllDropdowns();
  };

  const hasActiveFilters = statusFilter || assigneeFilter || priorityFilter || myTasksOnly;
  const activeFilterCount = [statusFilter, assigneeFilter, priorityFilter, myTasksOnly].filter(Boolean).length;
  // Allow access if user is space OWNER/ADMIN OR organization OWNER/ADMIN
  const canAccessSettings =
    userRole === 'OWNER' ||
    userRole === 'ADMIN' ||
    organizationRole === 'OWNER' ||
    organizationRole === 'ADMIN';
  const settingsUrl = `/${params.tenant}/spaces/${spaceSlug}/settings/details`;

  const sortLabels: Record<SortOption, string> = {
    'last-updated': 'Last Updated',
    'newest': 'Newest First',
    'oldest': 'Oldest First',
    'priority': 'Priority',
    'alphabetical': 'A–Z',
  };

  const filters: BoardFilters = {
    searchQuery,
    statusFilter,
    assigneeFilter,
    priorityFilter,
    sortBy,
    sortAsc,
    myTasksOnly,
    hiddenColumns,
  };

  const displayedCount = filteredTaskCount ?? totalTaskCount;

  // Tab icon mapping
  const tabIcons: Record<string, React.ReactNode> = {
    summary: <FileText className="h-4 w-4" />,
    board: <LayoutGrid className="h-4 w-4" />,
    timeline: <Clock className="h-4 w-4" />,
    calendar: <CalendarDays className="h-4 w-4" />,
    financials: <BarChart3 className="h-4 w-4" />,
    resources: <Link2 className="h-4 w-4" />,
  };

  return (
    <div className="flex flex-col gap-0">
      {/* ── Space header row ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              disabled={isUpdating}
              className="text-xl font-bold text-gray-900 dark:text-brand-off-white bg-transparent border-b-2 border-brand-light-pink focus:outline-none focus:border-brand-mid-pink transition-colors leading-snug"
            />
          ) : (
            <h2
              onClick={handleNameClick}
              className={[
                'text-xl font-bold text-gray-900 dark:text-brand-off-white truncate leading-snug',
                canAccessSettings && 'cursor-pointer hover:text-brand-light-pink transition-colors',
              ].join(' ')}
              title={canAccessSettings ? 'Click to edit' : undefined}
            >
              {spaceName}
            </h2>
          )}

          {canAccessSettings && !isEditingName && (
            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="shrink-0 p-1 rounded-md text-gray-400 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-all"
                title="Space settings"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showSettingsMenu && (
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
                  <div className="p-1">
                    <Link
                      href={settingsUrl}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                      onClick={() => setShowSettingsMenu(false)}
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Space Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <span className="shrink-0 inline-flex items-center rounded-full bg-brand-dark-pink/10 dark:bg-brand-dark-pink/15 text-brand-dark-pink dark:text-brand-light-pink px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          {templateLabel}
        </span>
      </div>

      {/* ── Tabs + Filter toolbar — unified bar ───────────────── */}
      <div className="relative rounded-t-xl overflow-hidden border border-b-0 border-gray-200/60 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-xl">
        {/* Tab row — pill-shaped segmented controls */}
        <div className="flex items-center gap-1 px-3 py-2">
          <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100/80 dark:bg-white/[0.04] p-1 border border-gray-200/50 dark:border-white/[0.06]">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const icon = tabIcons[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={[
                    'relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-white dark:bg-white/[0.08] text-brand-light-pink shadow-sm shadow-brand-light-pink/10 ring-1 ring-brand-light-pink/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  {icon && <span className={isActive ? 'text-brand-light-pink' : 'opacity-40'}>{icon}</span>}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filter toolbar ─────────────────────────────────────── */}
      <div className="relative mb-3 z-30" ref={toolbarRef}>
        <div className="flex items-center gap-2 rounded-b-xl border border-t-0 border-gray-200/60 dark:border-white/[0.06] bg-gradient-to-b from-gray-50/80 to-white/60 dark:from-gray-950/50 dark:to-gray-950/40 backdrop-blur-xl px-3 py-2">
          {/* Search — frosted glass effect */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-xl bg-gray-100/80 dark:bg-white/[0.04] backdrop-blur-sm border border-gray-200/60 dark:border-white/[0.06] pl-9 pr-7 py-2 text-sm text-gray-900 dark:text-brand-off-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-light-pink/40 focus-visible:border-brand-light-pink/30 transition-all shadow-inner shadow-black/[0.02] dark:shadow-black/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200 dark:bg-brand-mid-pink/15 shrink-0" />

          {/* Sort dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSortDropdown(!showSortDropdown);
                setShowStatusDropdown(false);
                setShowAssigneeDropdown(false);
                setShowPriorityDropdown(false);
                setShowColumnsDropdown(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
            >
              {sortLabels[sortBy]}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
            {showSortDropdown && (
              <div className="absolute left-0 top-full mt-1.5 z-20 min-w-[160px] rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-xl py-1 overflow-hidden">
                {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setSortBy(key); setShowSortDropdown(false); }}
                    className={[
                      'w-full text-left px-3 py-1.5 text-xs transition-colors',
                      sortBy === key
                        ? 'text-brand-light-pink bg-brand-light-pink/10 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort direction toggle */}
          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            title={sortAsc ? 'Ascending' : 'Descending'}
            className={[
              'rounded-lg p-1.5 transition-colors',
              sortAsc
                ? 'text-brand-light-pink bg-brand-light-pink/10'
                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-600 dark:hover:text-gray-300',
            ].join(' ')}
          >
            <ArrowUpDown className={`h-3.5 w-3.5 transition-transform ${sortAsc ? 'rotate-180' : ''}`} />
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200 dark:bg-brand-mid-pink/15 shrink-0" />

          {/* My Tasks toggle */}
          {currentUserId && (
            <button
              type="button"
              onClick={() => setMyTasksOnly(!myTasksOnly)}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                myTasksOnly
                  ? 'bg-brand-light-pink/15 text-brand-light-pink'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60',
              ].join(' ')}
            >
              <User className="h-3 w-3" />
              <span className="hidden sm:inline">My Tasks</span>
            </button>
          )}

          {/* Filters button with expandable dropdowns */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFiltersOpen(!filtersOpen);
                if (filtersOpen) closeAllDropdowns();
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                filtersOpen || hasActiveFilters
                  ? 'bg-brand-light-pink/15 text-brand-light-pink'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60',
              ].join(' ')}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="h-4.5 min-w-4.5 rounded-full bg-brand-light-pink text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter panel dropdown */}
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-20 w-[280px] rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Filters</span>
                    {hasActiveFilters && (
                      <button type="button" onClick={clearFilters} className="text-[11px] font-medium text-brand-light-pink hover:text-brand-mid-pink transition-colors">
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Status</label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setStatusFilter(null)}
                        className={[
                          'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          !statusFilter
                            ? 'bg-brand-light-pink/15 text-brand-light-pink'
                            : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                        ].join(' ')}
                      >
                        All
                      </button>
                      {columns.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setStatusFilter(statusFilter === col.id ? null : col.id)}
                          className={[
                            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors truncate max-w-[100px]',
                            statusFilter === col.id
                              ? 'bg-brand-light-pink/15 text-brand-light-pink'
                              : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                          ].join(' ')}
                          title={col.name}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Priority</label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setPriorityFilter(null)}
                        className={[
                          'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          !priorityFilter
                            ? 'bg-brand-light-pink/15 text-brand-light-pink'
                            : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                        ].join(' ')}
                      >
                        All
                      </button>
                      {(['Low', 'Normal', 'High', 'Urgent'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                          className={[
                            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                            priorityFilter === p
                              ? p === 'Urgent' ? 'bg-rose-500/15 text-rose-400' : p === 'High' ? 'bg-amber-500/15 text-amber-400' : p === 'Normal' ? 'bg-sky-500/15 text-sky-400' : 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                          ].join(' ')}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assignee */}
                  {assignees.length > 0 && (
                    <div>
                      <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Assignee</label>
                      <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => setAssigneeFilter(null)}
                          className={[
                            'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                            !assigneeFilter
                              ? 'bg-brand-light-pink/15 text-brand-light-pink'
                              : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                          ].join(' ')}
                        >
                          Any
                        </button>
                        {assignees.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAssigneeFilter(assigneeFilter === a ? null : a)}
                            className={[
                              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors truncate max-w-[120px]',
                              assigneeFilter === a
                                ? 'bg-brand-light-pink/15 text-brand-light-pink'
                                : 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
                            ].join(' ')}
                            title={a}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columns visibility toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColumnsDropdown(!showColumnsDropdown);
                setShowSortDropdown(false);
                setFiltersOpen(false);
              }}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                showColumnsDropdown
                  ? 'bg-brand-light-pink/15 text-brand-light-pink'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60',
              ].join(' ')}
            >
              <Columns3 className="h-3 w-3" />
              <span className="hidden sm:inline">Columns</span>
            </button>
            {showColumnsDropdown && (
              <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[180px] rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                <div className="p-2 space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-2 py-1 block">Show / Hide</span>
                  {columns.map((col) => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={!hiddenColumns.has(col.id)}
                        onChange={() => {
                          setHiddenColumns((prev) => {
                            const next = new Set(prev);
                            if (next.has(col.id)) next.delete(col.id);
                            else next.add(col.id);
                            return next;
                          });
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-light-pink focus:ring-brand-light-pink/50 h-3 w-3"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{col.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-gray-200 dark:bg-brand-mid-pink/15 shrink-0" />

          {/* Task count badge — pink accent glow */}
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-brand-light-pink/10 dark:bg-brand-light-pink/[0.08] border border-brand-light-pink/20 px-2.5 py-1.5 text-xs font-semibold text-brand-light-pink shrink-0 shadow-sm shadow-brand-light-pink/5">
            <Sparkles className="h-3 w-3" />
            <span className="tabular-nums">
              {displayedCount !== totalTaskCount ? (
                <>{displayedCount} <span className="text-brand-light-pink/50">/</span> {totalTaskCount}</>
              ) : (
                totalTaskCount
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── Content area (rendered by consumer) ───────────────── */}
      <div className="flex-1 min-h-0">
        {children(activeTab, filters)}
      </div>
    </div>
  );
}
