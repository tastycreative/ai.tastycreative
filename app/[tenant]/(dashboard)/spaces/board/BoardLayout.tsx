'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, MoreHorizontal, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export interface BoardTab {
  id: string;
  label: string;
}

export interface BoardFilters {
  searchQuery: string;
  statusFilter: string | null;
  assigneeFilter: string | null;
  priorityFilter: string | null;
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
  children,
}: BoardLayoutProps) {
  const params = useParams<{ tenant: string }>();
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(spaceName);
  const [isUpdating, setIsUpdating] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const clearFilters = () => {
    setStatusFilter(null);
    setAssigneeFilter(null);
    setPriorityFilter(null);
    setFiltersOpen(false);
  };

  const hasActiveFilters = statusFilter || assigneeFilter || priorityFilter;
  // Allow access if user is space OWNER/ADMIN OR organization OWNER/ADMIN
  const canAccessSettings =
    userRole === 'OWNER' ||
    userRole === 'ADMIN' ||
    organizationRole === 'OWNER' ||
    organizationRole === 'ADMIN';
  const settingsUrl = `/${params.tenant}/spaces/${spaceSlug}/settings/details`;

  const filters: BoardFilters = {
    searchQuery,
    statusFilter,
    assigneeFilter,
    priorityFilter,
  };

  return (
    <div className="flex flex-col gap-0">
      {/* ── Space header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-0.5">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                disabled={isUpdating}
                className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-brand-off-white bg-transparent border-b-2 border-brand-light-pink focus:outline-none focus:border-brand-mid-pink transition-colors px-1 -mx-1"
              />
            ) : (
              <h2
                onClick={handleNameClick}
                className={[
                  'text-xl sm:text-2xl font-bold text-gray-900 dark:text-brand-off-white truncate',
                  canAccessSettings && 'cursor-pointer hover:text-brand-light-pink transition-colors',
                ].join(' ')}
                title={canAccessSettings ? 'Click to edit' : undefined}
              >
                {spaceName}
              </h2>
            )}

            {/* Settings Menu - Only visible to OWNER and ADMIN */}
            {canAccessSettings && !isEditingName && (
              <div className="relative" ref={settingsMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                  title="Space settings"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {showSettingsMenu && (
                  <div className="absolute left-0 top-full mt-1 z-20 min-w-45 rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                    <div className="p-1">
                      <Link
                        href={settingsUrl}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                        onClick={() => setShowSettingsMenu(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Space Settings
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-linear-to-r from-brand-light-pink via-brand-mid-pink to-brand-blue rounded-full" />
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
              filtersOpen || hasActiveFilters
                ? 'border-brand-light-pink/40 bg-brand-light-pink/10 text-brand-light-pink'
                : 'border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 hover:border-brand-light-pink/40',
            ].join(' ')}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {hasActiveFilters && (
              <span className="ml-0.5 h-4 w-4 rounded-full bg-brand-light-pink text-white text-[9px] flex items-center justify-center">
                {[statusFilter, assigneeFilter, priorityFilter].filter(Boolean).length}
              </span>
            )}
          </button>

          {filtersOpen && (
            <>
              {/* Status Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusDropdown(!showStatusDropdown);
                    setShowAssigneeDropdown(false);
                    setShowPriorityDropdown(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-brand-light-pink/40 transition-colors"
                >
                  Status: {statusFilter ? columns.find((c) => c.id === statusFilter)?.name : 'All'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full mt-1 z-10 min-w-[160px] rounded-lg border border-gray-200 dark:border-brand-mid-pink/30 bg-white dark:bg-gray-800 shadow-lg py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter(null);
                        setShowStatusDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      All
                    </button>
                    {columns.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(col.id);
                          setShowStatusDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignee Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssigneeDropdown(!showAssigneeDropdown);
                    setShowStatusDropdown(false);
                    setShowPriorityDropdown(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-brand-light-pink/40 transition-colors"
                >
                  Assignee: {assigneeFilter || 'Any'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showAssigneeDropdown && (
                  <div className="absolute top-full mt-1 z-10 min-w-[160px] rounded-lg border border-gray-200 dark:border-brand-mid-pink/30 bg-white dark:bg-gray-800 shadow-lg py-1 max-h-[200px] overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeFilter(null);
                        setShowAssigneeDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Any
                    </button>
                    {assignees.map((assignee) => (
                      <button
                        key={assignee}
                        type="button"
                        onClick={() => {
                          setAssigneeFilter(assignee);
                          setShowAssigneeDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {assignee}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority Filter */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowPriorityDropdown(!showPriorityDropdown);
                    setShowStatusDropdown(false);
                    setShowAssigneeDropdown(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-brand-light-pink/40 transition-colors"
                >
                  Priority: {priorityFilter || 'All'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showPriorityDropdown && (
                  <div className="absolute top-full mt-1 z-10 min-w-[140px] rounded-lg border border-gray-200 dark:border-brand-mid-pink/30 bg-white dark:bg-gray-800 shadow-lg py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPriorityFilter(null);
                        setShowPriorityDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      All
                    </button>
                    {['Low', 'Medium', 'High'].map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => {
                          setPriorityFilter(priority);
                          setShowPriorityDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-gray-400 hover:text-brand-light-pink transition-colors"
                >
                  Clear All
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Content area (rendered by consumer) ───────────────── */}
      <div className="flex-1 min-h-0">
        {children(activeTab, filters)}
      </div>
    </div>
  );
}
