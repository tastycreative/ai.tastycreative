'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQAQueue, useSchedulerCaptionQA, type QAQueueItem, type SchedulerQAItem } from '@/lib/hooks/useQAQueue.query';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import QAQueuePanel from './QAQueuePanel';
import ReviewPanel from './ReviewPanel';
import SchedulerReviewPanel from './SchedulerReviewPanel';
import QAContextPanel from './QAContextPanel';

export type QASourceFilter = 'all' | 'content' | 'scheduler';

/** Unified queue item — discriminated by `source` field */
export type UnifiedQAItem =
  | (QAQueueItem & { source: 'content' })
  | SchedulerQAItem;

/** Get deadline timestamp (ms) for sorting scheduler items — soonest first */
function getDeadlineMs(taskDate: string, timeStr: string): number {
  try {
    const d = new Date(taskDate + 'T00:00:00Z');
    if (isNaN(d.getTime())) return Infinity;

    let hours = 23;
    let minutes = 59;
    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = (match[3] || '').toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    // Approximate LA→UTC: guess PDT (UTC-7)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hours + 7, minutes);
  } catch {
    return Infinity;
  }
}

export default function QAWorkspace() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<QASourceFilter>('all');

  const { data: rawContentQueue, isLoading: isLoadingContent, error: contentError } = useQAQueue();
  const { data: rawSchedulerQueue, isLoading: isLoadingScheduler } = useSchedulerCaptionQA();
  const { data: orgMembers = [] } = useOrgMembers();

  const isLoading = isLoadingContent || isLoadingScheduler;
  const error = contentError;

  // Build unified queue — scheduler items sorted by deadline (soonest first)
  const unifiedQueue = useMemo(() => {
    const contentItems: UnifiedQAItem[] = (rawContentQueue ?? []).map((item) => ({
      ...item,
      source: 'content' as const,
    }));
    const schedulerItems: UnifiedQAItem[] = (rawSchedulerQueue ?? []).slice().sort((a, b) => {
      const aMs = getDeadlineMs(a.taskDate, (a.fields?.time as string) || '');
      const bMs = getDeadlineMs(b.taskDate, (b.fields?.time as string) || '');
      return aMs - bMs; // soonest deadline first
    });
    return [...schedulerItems, ...contentItems];
  }, [rawContentQueue, rawSchedulerQueue]);

  // ── New-item notification ───────────────────────────────────
  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = unifiedQueue.length;
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      const diff = count - prevCountRef.current;
      toast.info(`${diff} new ticket${diff > 1 ? 's' : ''} in QA queue`, { duration: 4000 });
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } catch {
        // AudioContext may not be available
      }
    }
    prevCountRef.current = count;
  }, [unifiedQueue]);

  // Filter queue by source and search query
  const queue = useMemo(() => {
    let filtered = unifiedQueue;

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((item) => item.source === sourceFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        if (item.source === 'content') {
          const meta = item.metadata;
          const model = (meta.model as string) ?? '';
          const postOrigin = (meta.postOrigin as string) ?? '';
          const category = (meta.category as string) ?? '';
          return (
            item.title.toLowerCase().includes(q) ||
            model.toLowerCase().includes(q) ||
            postOrigin.toLowerCase().includes(q) ||
            category.toLowerCase().includes(q) ||
            String(item.itemNo).includes(q)
          );
        } else {
          // Scheduler item
          return (
            item.profileName.toLowerCase().includes(q) ||
            item.taskType.toLowerCase().includes(q) ||
            item.caption.toLowerCase().includes(q) ||
            item.platform.toLowerCase().includes(q)
          );
        }
      });
    }

    return filtered;
  }, [unifiedQueue, sourceFilter, searchQuery]);

  const selectedItem: UnifiedQAItem | undefined = queue[selectedIndex];

  const handleSelectTicket = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleReviewComplete = useCallback(() => {
    setSelectedIndex((prev) => {
      const maxIndex = Math.max(0, unifiedQueue.length - 2);
      return Math.min(prev, maxIndex);
    });
  }, [unifiedQueue]);

  const getMemberName = useCallback((id?: string | null) => {
    if (!id) return null;
    const m = orgMembers.find((mb) => mb.clerkId === id || mb.id === id);
    if (!m) return null;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  }, [orgMembers]);

  // Count by source for filter badges
  const contentCount = useMemo(() => unifiedQueue.filter((i) => i.source === 'content').length, [unifiedQueue]);
  const schedulerCount = useMemo(() => unifiedQueue.filter((i) => i.source === 'scheduler').length, [unifiedQueue]);

  return (
    <div className="h-[calc(100vh-7rem)] overflow-hidden bg-brand-off-white dark:bg-gray-950 border border-emerald-500/20 rounded-2xl shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] grid-rows-[60px_1fr] h-full">
        {/* Header */}
        <div className="col-span-1 lg:col-span-3 px-4 lg:px-6 border-b border-emerald-500/20 flex items-center justify-between bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl sticky top-0 z-40 rounded-t-2xl">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">QA Workspace</h1>
              <p className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400">Review captions & flyers</p>
            </div>
            <span className="hidden sm:inline-block px-2 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded text-[10px] lg:text-xs font-semibold">
              {queue.length}{searchQuery || sourceFilter !== 'all' ? `/${unifiedQueue.length}` : ''} to review
            </span>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="col-span-1 lg:col-span-3 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading QA queue...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="col-span-1 lg:col-span-3 p-6">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">Failed to load QA queue. Please refresh the page.</p>
            </div>
          </div>
        )}

        {/* Empty State — only when truly zero items (not just filtered empty) */}
        {!isLoading && !error && unifiedQueue.length === 0 && (
          <div className="col-span-1 lg:col-span-3 flex items-center justify-center py-20">
            <div className="text-center max-w-md px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">All caught up!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tickets are waiting for QA review. Items will appear here when they move to the QA column on the board.
              </p>
            </div>
          </div>
        )}

        {/* Main Content — show panels whenever we have data (even if filtered list is empty, so user can clear filters) */}
        {!isLoading && !error && unifiedQueue.length > 0 && (
          <>
            {/* Left Panel: Queue (always visible so user can change search/filter) */}
            <div className="hidden lg:flex lg:flex-col h-full overflow-hidden">
              <ErrorBoundary componentName="QA Queue Panel">
                <QAQueuePanel
                  queue={queue}
                  selectedIndex={selectedIndex}
                  onSelectTicket={handleSelectTicket}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  getMemberName={getMemberName}
                  sourceFilter={sourceFilter}
                  onSourceFilterChange={setSourceFilter}
                  contentCount={contentCount}
                  schedulerCount={schedulerCount}
                />
              </ErrorBoundary>
            </div>

            {/* Center Panel: Review */}
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
              <ErrorBoundary componentName="Review Panel">
                {selectedItem?.source === 'scheduler' ? (
                  <SchedulerReviewPanel
                    item={selectedItem}
                    onReviewComplete={handleReviewComplete}
                  />
                ) : (
                  <ReviewPanel
                    item={selectedItem?.source === 'content' ? selectedItem : undefined}
                    getMemberName={getMemberName}
                    onReviewComplete={handleReviewComplete}
                    tenant={tenant}
                  />
                )}
              </ErrorBoundary>
            </div>

            {/* Right Panel: Model Context */}
            <div className="hidden lg:flex border-l border-emerald-500/20 flex-col overflow-hidden bg-white dark:bg-gray-900/80">
              <ErrorBoundary componentName="QA Context Panel">
                <QAContextPanel
                  item={selectedItem?.source === 'content' ? selectedItem : undefined}
                  schedulerItem={selectedItem?.source === 'scheduler' ? selectedItem : undefined}
                />
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
