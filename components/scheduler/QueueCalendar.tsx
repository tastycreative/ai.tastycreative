'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Trash2,
  Loader2,
  Calendar,
  Flag,
} from 'lucide-react';
import {
  SchedulerTask,
  useTaskLineage,
  useDeleteSchedulerTask,
} from '@/lib/hooks/useScheduler.query';
import { getWeekStart, formatDateKey, DAY_NAMES_FULL } from '@/lib/scheduler/rotation';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'PENDING', label: 'Pending', color: '#3a3a5a' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#38bdf8' },
  { key: 'DONE', label: 'Done', color: '#4ade80' },
  { key: 'SKIPPED', label: 'Skipped', color: '#fbbf24' },
];

// ─── Calendar helpers ────────────────────────────────────────────────────────

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Exported component ──────────────────────────────────────────────────────

export interface QueueCalendarProps {
  task: SchedulerTask;
  schedulerToday: string;
  weekStart: string;
  typeColor: string;
  /** Which week is selected as the queue target (highlighted on calendar) */
  queueTargetWeek?: string | null;
  /** Called when user clicks an empty future matching day */
  onSelectQueueTarget?: (weekStart: string | null) => void;
  /** Called when user clicks a day/item that has an existing lineage task */
  onSelectTask?: (task: SchedulerTask) => void;
  /** ID of the task currently being viewed (for highlight in queued list) */
  activeTaskId?: string;
  /** Called after a queued task is deleted (receives the deleted task id) */
  onDeleteTask?: (deletedTaskId: string) => void;
}

export function QueueCalendar({
  task,
  schedulerToday,
  weekStart,
  typeColor,
  queueTargetWeek,
  onSelectQueueTarget,
  onSelectTask,
  activeTaskId,
  onDeleteTask,
}: QueueCalendarProps) {
  const today = new Date();
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const hasLineage = !!task.lineageId;
  const { data: lineageData, isLoading: lineageLoading } = useTaskLineage(task.lineageId);
  const deleteMutation = useDeleteSchedulerTask();

  const lineageTasks = lineageData?.tasks ?? [];

  // Build date→task map and future tasks list
  const { futureTasks, taskDateMap, existingWeekStarts } = useMemo(() => {
    const futureArr: SchedulerTask[] = [];
    const dateMap = new Map<string, SchedulerTask>();
    const wsSet = new Set<string>();

    for (const t of lineageTasks) {
      const ws = typeof t.weekStartDate === 'string' ? t.weekStartDate.split('T')[0] : String(t.weekStartDate);
      wsSet.add(ws);

      const wsDate = new Date(ws + 'T00:00:00Z');
      wsDate.setUTCDate(wsDate.getUTCDate() + t.dayOfWeek);
      const dateKey = wsDate.toISOString().split('T')[0];
      dateMap.set(dateKey, t);

      if (ws > weekStart) futureArr.push(t);
    }

    futureArr.sort((a, b) => {
      const wsA = typeof a.weekStartDate === 'string' ? a.weekStartDate.split('T')[0] : String(a.weekStartDate);
      const wsB = typeof b.weekStartDate === 'string' ? b.weekStartDate.split('T')[0] : String(b.weekStartDate);
      return wsA.localeCompare(wsB);
    });

    return { futureTasks: futureArr, taskDateMap: dateMap, existingWeekStarts: wsSet };
  }, [lineageTasks, weekStart]);

  const days = getCalendarDays(calMonth.year, calMonth.month);
  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = useCallback(() => {
    setCalMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }));
  }, []);

  const nextMonth = useCallback(() => {
    setCalMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }));
  }, []);

  const handleDayClick = useCallback(
    (day: number) => {
      if (!hasLineage) return;

      const dateKey = buildDateKey(calMonth.year, calMonth.month, day);

      // If this day has an existing task, load it into fields
      const existingTask = taskDateMap.get(dateKey);
      if (existingTask) {
        onSelectTask?.(existingTask);
        return;
      }

      if (dateKey < schedulerToday) return;

      // Only matching dayOfWeek is selectable for queuing
      const cellDow = new Date(Date.UTC(calMonth.year, calMonth.month, day)).getUTCDay();
      if (cellDow !== task.dayOfWeek) return;

      const clickedDate = new Date(Date.UTC(calMonth.year, calMonth.month, day));
      const wsDate = getWeekStart(clickedDate);
      const wsKey = formatDateKey(wsDate);

      if (wsKey <= weekStart) return;
      if (existingWeekStarts.has(wsKey)) return;

      // Toggle selection: click same day again to deselect
      onSelectQueueTarget?.(queueTargetWeek === wsKey ? null : wsKey);
    },
    [calMonth, schedulerToday, weekStart, existingWeekStarts, task.dayOfWeek, hasLineage, taskDateMap, queueTargetWeek, onSelectQueueTarget, onSelectTask],
  );

  const dayLabel = DAY_NAMES_FULL[task.dayOfWeek] || '';

  return (
    <div className="p-3 space-y-3">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <Calendar className="h-3 w-3 text-gray-400" />
        <span className="text-[9px] font-bold tracking-wider font-sans text-gray-400">QUEUE CALENDAR</span>
        {hasLineage && (
          <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600 ml-auto">
            {dayLabel}s only
          </span>
        )}
      </div>

      {!hasLineage && (
        <p className="text-[10px] font-mono text-gray-400 dark:text-gray-600 py-2 text-center">
          No lineage linked to this task.
        </p>
      )}

      {/* Calendar */}
      {hasLineage && (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-gray-400" />
            </button>
            <span className="text-[11px] font-bold font-sans text-gray-700 dark:text-gray-300">
              {monthLabel}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div
                key={i}
                className={[
                  'text-[8px] font-bold font-sans py-0.5',
                  i === task.dayOfWeek
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-600',
                ].join(' ')}
                style={i === task.dayOfWeek ? { color: typeColor } : undefined}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, idx) => {
              if (day === null) return <div key={idx} className="h-7" />;

              const dateKey = buildDateKey(calMonth.year, calMonth.month, day);
              const isPast = dateKey < schedulerToday;
              const isToday = dateKey === schedulerToday;

              const cellDate = new Date(Date.UTC(calMonth.year, calMonth.month, day));
              const cellDow = cellDate.getUTCDay();
              const cellWsKey = formatDateKey(getWeekStart(cellDate));
              const isCurrentWeek = cellWsKey === weekStart;
              const isMatchingDay = cellDow === task.dayOfWeek;

              const taskOnDay = taskDateMap.get(dateKey);
              const hasTask = !!taskOnDay;
              const taskStatusColor = taskOnDay
                ? (STATUS_OPTIONS.find((s) => s.key === taskOnDay.status)?.color || '#3a3a5a')
                : undefined;
              const isActiveTask = hasTask && taskOnDay.id === activeTaskId;
              const taskFlagged = hasTask && ((taskOnDay.fields as Record<string, string>)?.flagged === 'true');

              // Is this day the selected queue target?
              const isQueueTarget = queueTargetWeek === cellWsKey && isMatchingDay && !hasTask;

              const isBeforeCurrentWeek = cellWsKey <= weekStart;
              const canQueue = isMatchingDay && !isPast && !isCurrentWeek && cellWsKey > weekStart && !existingWeekStarts.has(cellWsKey);
              const isClickable = !isBeforeCurrentWeek && (hasTask || canQueue);

              return (
                <button
                  key={idx}
                  onClick={() => isClickable && handleDayClick(day)}
                  disabled={!isClickable}
                  className={[
                    'relative h-7 rounded text-[10px] font-mono transition-all',
                    // Queue target: filled bg with type color — stands out clearly
                    isQueueTarget ? 'font-bold text-white rounded-md scale-110 z-10' : '',
                    // Existing task being viewed
                    !isQueueTarget && isActiveTask ? 'font-bold rounded-md' : '',
                    // Today ring
                    !isQueueTarget && isToday ? 'ring-1 ring-brand-light-pink font-bold' : '',
                    // Current week subtle bg
                    !isQueueTarget && isCurrentWeek ? 'bg-gray-100 dark:bg-white/5' : '',
                    // Matching day column tint
                    !isQueueTarget && isMatchingDay && !isCurrentWeek ? 'bg-gray-50 dark:bg-white/[0.02]' : '',
                    // Text colors
                    isQueueTarget
                      ? ''
                      : isPast
                        ? 'text-gray-300 dark:text-gray-700'
                        : isClickable
                          ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer'
                          : 'text-gray-300 dark:text-gray-700',
                  ].join(' ')}
                  style={{
                    ...(isQueueTarget ? { background: typeColor, color: '#fff', boxShadow: `0 2px 8px ${typeColor}60` } : {}),
                    ...(isActiveTask && !isQueueTarget ? { background: typeColor + '15', boxShadow: `0 0 0 1.5px ${typeColor}50` } : {}),
                  }}
                  title={
                    hasTask
                      ? `${taskOnDay.taskType} - ${STATUS_OPTIONS.find((s) => s.key === taskOnDay.status)?.label || taskOnDay.status} (click to view)`
                      : isQueueTarget
                        ? 'Selected — click Queue button to confirm'
                        : canQueue
                          ? `Click to select this ${dayLabel} for queuing`
                          : !isMatchingDay
                            ? `Only ${dayLabel}s are selectable`
                            : undefined
                  }
                >
                  {day}
                  {/* Queue target pulsing dot */}
                  {isQueueTarget && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full animate-pulse"
                      style={{ background: typeColor, boxShadow: `0 0 4px ${typeColor}` }}
                    />
                  )}
                  {hasTask && (
                    <>
                      <span
                        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full"
                        style={{ background: taskStatusColor || typeColor, opacity: isPast ? 0.4 : 1 }}
                      />
                      {taskFlagged && (
                        <Flag
                          className="absolute top-0 right-0 h-2 w-2 text-amber-500"
                          fill="currentColor"
                          style={{ opacity: isPast ? 0.4 : 1 }}
                        />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Queued updates list */}
      {hasLineage && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold tracking-wider font-sans text-blue-500">QUEUED UPDATES</span>
            <div className="flex-1 h-px bg-blue-500/20" />
          </div>

          {lineageLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-3 w-3 animate-spin text-brand-blue" />
            </div>
          )}

          {!lineageLoading && futureTasks.length === 0 && (
            <p className="text-[10px] font-mono text-gray-400 dark:text-gray-600 py-2 text-center">
              No queued updates
            </p>
          )}

          {futureTasks.map((t) => {
            const ws = typeof t.weekStartDate === 'string' ? t.weekStartDate.split('T')[0] : String(t.weekStartDate);
            const taskDateObj = new Date(ws + 'T00:00:00Z');
            taskDateObj.setUTCDate(taskDateObj.getUTCDate() + t.dayOfWeek);
            const weekLbl = !isNaN(taskDateObj.getTime())
              ? taskDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
              : ws;
            const statusOpt = STATUS_OPTIONS.find((s) => s.key === t.status) || STATUS_OPTIONS[0];
            const isActive = t.id === activeTaskId;
            const tFlagged = (t.fields as Record<string, string>)?.flagged === 'true';

            return (
              <div
                key={t.id}
                onClick={() => onSelectTask?.(t)}
                className={[
                  'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer',
                  isActive
                    ? 'bg-gray-100 dark:bg-white/5'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]',
                ].join(' ')}
                style={isActive ? { outline: `1px solid ${typeColor}40` } : undefined}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: statusOpt.color }} />
                <span className="text-[9px] font-mono text-gray-500 dark:text-gray-500 shrink-0">
                  {weekLbl}
                </span>
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: statusOpt.color + '20', color: statusOpt.color }}
                >
                  {statusOpt.label}
                </span>
                {tFlagged && (
                  <Flag className="h-2.5 w-2.5 text-amber-500 shrink-0" fill="currentColor" />
                )}
                <div className="flex-1" />
                {confirmDeleteId === t.id ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[8px] font-sans text-red-400">Delete?</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ id: t.id }, {
                          onSuccess: () => {
                            setConfirmDeleteId(null);
                            onDeleteTask?.(t.id);
                          },
                        });
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-[8px] font-bold font-sans px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors"
                    >
                      {deleteMutation.isPending ? '...' : 'Yes'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                      }}
                      className="text-[8px] font-bold font-sans px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(t.id);
                    }}
                    className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    title="Cancel queued update"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

