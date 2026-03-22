'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  useHistoryCounts,
  useCalendarHistory,
  CalendarHistoryItem,
  TASK_FIELD_DEFS,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS } from './task-cards/shared';

const LA_TZ = 'America/Los_Angeles';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Field label map (same as modal) ─────────────────────────────────────────

const ALL_FIELD_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {
    status: 'Status',
    taskType: 'Type',
    taskName: 'Task Name',
    notes: 'Notes',
    sortOrder: 'Sort Order',
  };
  for (const [, defs] of Object.entries(TASK_FIELD_DEFS)) {
    for (const d of defs) {
      map[`fields.${d.key}`] = d.label;
    }
  }
  return map;
})();

function humanFieldLabel(field: string): string {
  return ALL_FIELD_LABELS[field] || field.replace('fields.', '');
}

function truncate(val: string | null, max = 40): string {
  if (!val) return '(empty)';
  return val.length > max ? val.slice(0, max) + '...' : val;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SchedulerHistoryCalendarProps {
  open: boolean;
  onClose: () => void;
  profileId: string | null;
  platform: string;
}

export function SchedulerHistoryCalendar({
  open,
  onClose,
  profileId,
  platform,
}: SchedulerHistoryCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthKey = getMonthKey(viewDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { data: countsData, isLoading: countsLoading } = useHistoryCounts(
    monthKey,
    profileId,
    platform,
  );
  const counts = countsData?.counts ?? {};

  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: historyLoading,
  } = useCalendarHistory(selectedDate, profileId, platform);

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const historyItems = historyData?.pages.flatMap((p) => p.items) ?? [];

  // Group history items by task
  const groupedByTask = useMemo(() => {
    const map = new Map<string, { task: CalendarHistoryItem['task']; items: CalendarHistoryItem[] }>();
    for (const item of historyItems) {
      const existing = map.get(item.task.id);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.task.id, { task: item.task, items: [item] });
      }
    }
    return [...map.values()];
  }, [historyItems]);

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  };

  const monthLabel = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-y-0 right-0 z-40 w-96 flex flex-col shadow-2xl bg-white border-l border-gray-200 dark:bg-[#0b0b1a] dark:border-[#111124]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#111124]">
        <h3 className="text-xs font-bold tracking-wide font-sans text-gray-900 dark:text-zinc-300">
          Change History
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5">
          <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[#111124]">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronLeft className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <span className="text-[11px] font-bold font-sans text-gray-700 dark:text-zinc-300">
            {monthLabel}
          </span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[8px] font-bold font-sans text-gray-400 dark:text-gray-600">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const count = counts[dateStr] || 0;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === new Date().toISOString().slice(0, 10);

            return (
              <button
                key={i}
                onClick={() => handleDayClick(day)}
                className={`relative flex flex-col items-center py-1 rounded-md text-[10px] font-mono transition-all ${
                  isSelected
                    ? 'bg-brand-blue/20 text-brand-blue ring-1 ring-brand-blue/40'
                    : isToday
                      ? 'bg-brand-light-pink/10 text-brand-light-pink'
                      : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'
                }`}
              >
                <span className="leading-none">{day}</span>
                {count > 0 && (
                  <span
                    className={`mt-0.5 text-[7px] font-bold px-1 rounded-full leading-tight ${
                      isSelected
                        ? 'bg-brand-blue/30 text-brand-blue'
                        : 'bg-brand-light-pink/20 text-brand-light-pink'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {countsLoading && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Selected day details */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDate && (
          <p className="text-[10px] text-center py-10 font-mono text-gray-400 dark:text-[#3a3a5a]">
            Click a day to view changes.
          </p>
        )}

        {selectedDate && historyLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-brand-blue dark:text-[#38bdf8]" />
          </div>
        )}

        {selectedDate && !historyLoading && historyItems.length === 0 && (
          <p className="text-[10px] text-center py-10 font-mono text-gray-400 dark:text-[#3a3a5a]">
            No changes on this day.
          </p>
        )}

        {groupedByTask.map(({ task, items }) => (
          <div key={task.id} className="border-b border-gray-100 dark:border-[#0c0c1f]">
            {/* Task header */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-[#0c0c18] flex items-center gap-2">
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: (TASK_TYPE_COLORS[task.taskType] || '#555') + '20',
                  color: TASK_TYPE_COLORS[task.taskType] || '#555',
                }}
              >
                {task.taskType}
              </span>
              <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 truncate">
                {task.slotLabel}
              </span>
            </div>

            {/* Changes for this task */}
            {items.map((item) => (
              <div
                key={item.id}
                className="px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start gap-2">
                  {item.user.imageUrl ? (
                    <img src={item.user.imageUrl} alt="" className="h-3.5 w-3.5 rounded-full flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full flex-shrink-0 mt-0.5 bg-brand-light-pink/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-mono text-gray-500 dark:text-[#888]">
                      <span className="font-bold text-gray-700 dark:text-[#aaa]">
                        {item.user.name || 'Unknown'}
                      </span>{' '}
                      changed{' '}
                      <span className="font-bold">{humanFieldLabel(item.field)}</span>
                    </p>
                    <div className="flex items-center gap-1 text-[8px] font-mono mt-0.5">
                      <span className="text-red-400 line-through">{truncate(item.oldValue)}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-500">{truncate(item.newValue)}</span>
                    </div>
                    <p className="text-[7px] mt-0.5 font-mono text-gray-300 dark:text-[#252545]">
                      {new Date(item.createdAt).toLocaleString('en-US', {
                        timeZone: LA_TZ,
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {hasNextPage && (
          <div className="px-4 py-3 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-[10px] font-bold font-sans text-brand-blue dark:text-[#38bdf8]"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
