'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Settings2 } from 'lucide-react';
import {
  useSchedulerMonth,
  SchedulerTask,
  useUpdatePodTask,
  TaskLimits,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS, TASK_TYPES } from './task-cards/shared';
import { SchedulerTaskModal } from './SchedulerTaskModal';
import { tabId } from '@/lib/hooks/useSchedulerRealtime';

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  free: '#4ade80',
  paid: '#f472b6',
  oftv: '#38bdf8',
  fansly: '#c084fc',
};

const PLATFORM_LABELS: Record<string, string> = {
  free: 'Free',
  paid: 'Paid',
  oftv: 'OFTV',
  fansly: 'Fansly',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',
  IN_PROGRESS: '#38bdf8',
  DONE: '#4ade80',
  SKIPPED: '#fbbf24',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  SKIPPED: 'Skipped',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Props ───────────────────────────────────────────────────────────────────

interface SchedulerDashboardProps {
  profileId: string | null;
  schedulerToday: string;
  weekStart: string;
  onSwitchPlatform: (platform: string) => void;
  taskLimits?: TaskLimits | null;
  onSavePlatformLimits?: (platform: string, typeLimits: Record<string, number>) => void;
  profileName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTaskDate(task: SchedulerTask): string {
  const ws = new Date(task.weekStartDate);
  const d = new Date(ws);
  d.setUTCDate(d.getUTCDate() + task.dayOfWeek);
  return d.toISOString().split('T')[0];
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ─── Task Chip (reusable for calendar cells + expanded popover) ──────────────

function getTaskLabel(task: SchedulerTask): string {
  const f = (task.fields || {}) as Record<string, string>;
  switch (task.taskType) {
    case 'MM':
      return f.type || task.taskName || '';
    case 'WP':
      return f.postSchedule || f.type || task.taskName || '';
    case 'ST':
      return task.taskName || '';
    case 'SP':
      return f.subscriberPromoSchedule || f.type || task.taskName || '';
    default:
      return task.taskName || '';
  }
}

function getTaskTime(task: SchedulerTask): string {
  const f = (task.fields || {}) as Record<string, string>;
  if (task.taskType === 'ST') return f.storyPostSchedule || '';
  return f.time || '';
}

function TaskChip({
  task,
  onSelect,
  showPlatformLabel,
}: {
  task: SchedulerTask;
  onSelect: (t: SchedulerTask) => void;
  showPlatformLabel?: boolean;
}) {
  const fields = (task.fields || {}) as Record<string, string>;
  const typeColor = TASK_TYPE_COLORS[task.taskType] || '#888';
  const time = getTaskTime(task);
  const label = getTaskLabel(task);
  const caption = fields.captionBankText || fields.caption;
  const isFlagged = fields.flagged === 'true' || fields.flagged === (true as unknown as string);

  return (
    <button
      onClick={() => onSelect(task)}
      className="w-full rounded text-left transition-all hover:bg-gray-100 dark:hover:bg-white/5 px-1 py-0.5"
      style={{ borderLeft: `2px solid ${isFlagged ? '#f59e0b' : typeColor}` }}
    >
      {/* Row 1: status dot + time + label + type badge */}
      <div className="flex items-center gap-1 leading-none">
        <div
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLORS[task.status] || '#888' }}
        />
        {showPlatformLabel && (
          <span
            className="text-[7px] font-bold font-sans shrink-0 uppercase"
            style={{ color: PLATFORM_COLORS[task.platform] || '#888' }}
          >
            {PLATFORM_LABELS[task.platform] || task.platform}
          </span>
        )}
        {time && (
          <span className="text-[7px] font-mono shrink-0" style={{ color: typeColor }}>
            {time}
          </span>
        )}
        <span className="text-[8px] font-semibold truncate text-gray-700 dark:text-gray-300 flex-1 min-w-0">
          {label}
        </span>
        <span
          className="text-[7px] font-bold font-sans shrink-0 px-1 rounded-sm"
          style={{ background: typeColor + '18', color: typeColor }}
        >
          {task.taskType}
        </span>
        {!showPlatformLabel && (
          <div
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: PLATFORM_COLORS[task.platform] || '#888' }}
            title={PLATFORM_LABELS[task.platform] || task.platform}
          />
        )}
      </div>
      {/* Row 2: caption preview (if expanded popover) */}
      {showPlatformLabel && caption && (
        <div className="text-[7px] font-mono truncate text-gray-400 dark:text-gray-600 mt-0.5 ml-[10px]">
          {caption}
        </div>
      )}
    </button>
  );
}

// ─── Simple Type Count Badge ─────────────────────────────────────────────────

function TypeCountBadge({ type, count }: { type: string; count: number }) {
  const color = TASK_TYPE_COLORS[type] || '#3a3a5a';
  return (
    <span
      className="text-[8px] font-bold px-1.5 py-0.5 rounded font-sans"
      style={{
        background: color + '18',
        color: color,
        border: `1px solid ${color + '30'}`,
      }}
    >
      {count} {type}
    </span>
  );
}

// ─── Limits Settings Popover ─────────────────────────────────────────────────

function LimitsPopover({
  platform,
  taskLimits,
  onSave,
}: {
  platform: string;
  taskLimits?: TaskLimits | null;
  onSave: (platform: string, typeLimits: Record<string, number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  // Sync local values from per-platform defaults when popover opens
  useEffect(() => {
    if (open) {
      const vals: Record<string, string> = {};
      const platLimits = taskLimits?.platformDefaults?.[platform];
      for (const type of TASK_TYPES as readonly string[]) {
        const cur = platLimits?.[type];
        vals[type] = cur !== undefined && cur > 0 ? String(cur) : '';
      }
      setLocalValues(vals);
    }
  }, [open, taskLimits, platform]);

  // Build the limits map from local values and save in one call
  const saveAndClose = useCallback(() => {
    const typeLimits: Record<string, number> = {};
    for (const type of TASK_TYPES as readonly string[]) {
      const val = (localValues[type] || '').trim();
      if (val !== '' && val !== '0') {
        const n = parseInt(val);
        if (!isNaN(n) && n > 0) typeLimits[type] = n;
      }
    }
    onSave(platform, typeLimits);
    setOpen(false);
  }, [localValues, platform, onSave]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        saveAndClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [open, saveAndClose]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            saveAndClose();
          } else {
            setOpen(true);
          }
        }}
        className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        title="Set volume limits per type"
      >
        <Settings2 className="h-3 w-3 text-gray-400 dark:text-gray-600" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl border bg-white border-gray-200 dark:bg-[#0c0c1a] dark:border-[#1a1a2e] p-3 min-w-[180px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[9px] font-bold font-sans text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-2">
            Default Limits
          </div>
          <div className="space-y-2">
            {(TASK_TYPES as readonly string[]).map((type) => {
              const color = TASK_TYPE_COLORS[type] || '#3a3a5a';
              const val = localValues[type] || '';
              const hasLimit = val !== '' && val !== '0';
              return (
                <div key={type} className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold font-sans w-6"
                    style={{ color }}
                  >
                    {type}
                  </span>
                  <input
                    type="number"
                    min={0}
                    placeholder="--"
                    value={val}
                    onChange={(e) =>
                      setLocalValues((prev) => ({ ...prev, [type]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveAndClose();
                      if (e.key === 'Escape') setOpen(false);
                    }}
                    className="flex-1 px-1.5 py-1 text-[10px] rounded border outline-none font-mono bg-gray-50 border-gray-200 text-gray-900 dark:bg-[#07070f] dark:border-[#222] dark:text-zinc-300 focus:border-brand-blue dark:focus:border-brand-blue [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ borderColor: hasLimit ? color + '40' : undefined }}
                  />
                  <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600 w-8">
                    {hasLimit ? '/ day' : 'none'}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[8px] font-mono text-gray-400 dark:text-gray-600 mt-2">
            Set max tasks per type per day. Clear to remove.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchedulerDashboard({
  profileId,
  schedulerToday,
  weekStart,
  onSwitchPlatform,
  taskLimits,
  onSavePlatformLimits,
  profileName,
}: SchedulerDashboardProps) {
  const today = new Date(schedulerToday + 'T00:00:00Z');
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthKey(today));

  const { data: monthData, isLoading } = useSchedulerMonth(calendarMonth, profileId);
  const tasks = monthData?.tasks ?? [];

  const updateTask = useUpdatePodTask();

  // ─── Task modal state ───
  const [selectedTask, setSelectedTask] = useState<SchedulerTask | null>(null);

  // ─── Expanded day popover (for "+N more") ───
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedDay(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTaskUpdate = useCallback(
    (id: string, data: Partial<SchedulerTask>) => {
      updateTask.mutate({ id, ...data, tabId });
    },
    [updateTask],
  );


  // ─── Week-based summary (tasks in the current week) ───
  const weekTasks = useMemo(() => {
    const ws = new Date(weekStart + 'T00:00:00Z');
    const weEnd = new Date(ws);
    weEnd.setUTCDate(weEnd.getUTCDate() + 6);
    const wsKey = weekStart;
    const weKey = weEnd.toISOString().split('T')[0];
    return tasks.filter((t) => {
      const d = getTaskDate(t);
      return d >= wsKey && d <= weKey;
    });
  }, [tasks, weekStart]);

  // ─── Platform summary ───
  const platformSummary = useMemo(() => {
    const platforms = ['free', 'paid', 'oftv', 'fansly'];
    return platforms.map((p) => {
      const pTasks = weekTasks.filter((t) => t.platform === p);
      const total = pTasks.length;
      const pending = pTasks.filter((t) => t.status === 'PENDING').length;
      const inProgress = pTasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const done = pTasks.filter((t) => t.status === 'DONE').length;
      const skipped = pTasks.filter((t) => t.status === 'SKIPPED').length;
      const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
      // Per-type counts (weekly total across all 7 days)
      const typeCounts = (TASK_TYPES as readonly string[]).map((type) => ({
        type,
        count: pTasks.filter((t) => t.taskType === type).length,
      }));
      return { key: p, total, pending, inProgress, done, skipped, completionPct, typeCounts };
    });
  }, [weekTasks]);

  // ─── Analytics: completion per platform ───
  const overallCompletion = useMemo(() => {
    const total = weekTasks.length;
    const done = weekTasks.filter((t) => t.status === 'DONE').length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [weekTasks]);

  // ─── Analytics: workload heatmap (this week) ───
  const weeklyHeatmap = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    for (const t of weekTasks) {
      if (t.dayOfWeek >= 0 && t.dayOfWeek < 7) counts[t.dayOfWeek]++;
    }
    const max = Math.max(...counts, 1);
    return counts.map((count, i) => ({ day: DAY_LABELS[i], count, intensity: count / max }));
  }, [weekTasks]);

  // ─── Analytics: type breakdown ───
  const typeBreakdown = useMemo(() => {
    return TASK_TYPES.map((type) => {
      const typed = weekTasks.filter((t) => t.taskType === type);
      const total = typed.length;
      const pending = typed.filter((t) => t.status === 'PENDING').length;
      const inProgress = typed.filter((t) => t.status === 'IN_PROGRESS').length;
      const done = typed.filter((t) => t.status === 'DONE').length;
      const skipped = typed.filter((t) => t.status === 'SKIPPED').length;
      return { type, total, pending, inProgress, done, skipped };
    });
  }, [weekTasks]);

  // ─── Calendar data ───
  const calendarData = useMemo(() => {
    const [year, mon] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, mon - 1, 1));
    const lastDay = new Date(Date.UTC(year, mon, 0));
    const daysInMonth = lastDay.getUTCDate();
    const startDow = firstDay.getUTCDay(); // 0=Sun

    // Build task map: dateKey -> tasks
    const taskMap = new Map<string, SchedulerTask[]>();
    for (const t of tasks) {
      const dateKey = getTaskDate(t);
      if (!taskMap.has(dateKey)) taskMap.set(dateKey, []);
      taskMap.get(dateKey)!.push(t);
    }

    // Build calendar grid (6 rows x 7 cols max)
    const weeks: { date: number | null; dateKey: string; tasks: SchedulerTask[] }[][] = [];
    let currentWeek: { date: number | null; dateKey: string; tasks: SchedulerTask[] }[] = [];

    // Leading blanks
    for (let i = 0; i < startDow; i++) {
      currentWeek.push({ date: null, dateKey: '', tasks: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      currentWeek.push({ date: d, dateKey, tasks: taskMap.get(dateKey) ?? [] });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    // Trailing blanks
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: null, dateKey: '', tasks: [] });
      }
      weeks.push(currentWeek);
    }

    return { weeks, year, mon, daysInMonth };
  }, [calendarMonth, tasks]);

  // ─── Month navigation ───
  const navigateMonth = useCallback(
    (delta: number) => {
      const [y, m] = calendarMonth.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + delta, 1));
      setCalendarMonth(getMonthKey(d));
    },
    [calendarMonth],
  );

  const monthLabel = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [calendarMonth]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* ─── Section A: Platform Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {platformSummary.map((p) => (
          <div
            key={p.key}
            className="text-left rounded-xl border p-3 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124]"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PLATFORM_COLORS[p.key] }}
              />
              <span className="text-xs font-bold font-sans text-gray-800 dark:text-zinc-200">
                {PLATFORM_LABELS[p.key]}
              </span>
              <span className="ml-auto text-[10px] font-mono text-gray-400 dark:text-gray-600">
                {p.total} tasks
              </span>
              {/* {onSavePlatformLimits && (
                <LimitsPopover
                  platform={p.key}
                  taskLimits={taskLimits}
                  onSave={onSavePlatformLimits}
                />
              )} */}
            </div>
            {/* Per-type volume counts */}
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {p.typeCounts.map((tc) => (
                <TypeCountBadge key={tc.type} type={tc.type} count={tc.count} />
              ))}
            </div>
            <div className="flex items-center gap-2 text-[9px] font-mono mb-2">
              <span style={{ color: STATUS_COLORS.PENDING }}>{p.pending} pending</span>
              <span style={{ color: STATUS_COLORS.IN_PROGRESS }}>{p.inProgress} active</span>
              <span style={{ color: STATUS_COLORS.DONE }}>{p.done} done</span>
              <span style={{ color: STATUS_COLORS.SKIPPED }}>{p.skipped} skip</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-[#151528] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${p.completionPct}%`,
                  backgroundColor: PLATFORM_COLORS[p.key],
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-400 dark:text-gray-600 mt-1 block">
              {p.completionPct}% complete
            </span>
          </div>
        ))}
      </div>

      {/* ─── Section B: Analytics Charts ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Completion Donut */}
        <div className="rounded-xl border p-3 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124]">
          <h3 className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-3">
            Completion Rate
          </h3>
          <div className="flex items-center justify-center">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {/* Background ring */}
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="currentColor"
                  className="text-gray-100 dark:text-[#151528]"
                  strokeWidth="8"
                />
                {/* Platform rings */}
                {platformSummary.map((p, i) => {
                  const total = p.total || 1;
                  const pct = p.done / total;
                  const circumference = 2 * Math.PI * (40 - i * 2);
                  const radius = 40 - i * 2;
                  return (
                    <circle
                      key={p.key}
                      cx="50" cy="50" r={radius}
                      fill="none"
                      stroke={PLATFORM_COLORS[p.key]}
                      strokeWidth="3"
                      strokeDasharray={`${pct * circumference} ${circumference}`}
                      strokeLinecap="round"
                      opacity={p.total > 0 ? 0.85 : 0.15}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold font-sans text-gray-800 dark:text-zinc-200">
                  {overallCompletion}%
                </span>
                <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600">overall</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {platformSummary
              .filter((p) => p.total > 0)
              .map((p) => (
                <div key={p.key} className="flex items-center gap-1">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS[p.key] }}
                  />
                  <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600">
                    {PLATFORM_LABELS[p.key]} {p.completionPct}%
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Weekly Workload Heatmap */}
        <div className="rounded-xl border p-3 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124]">
          <h3 className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-3">
            Weekly Workload
          </h3>
          <div className="grid grid-cols-7 gap-1.5">
            {weeklyHeatmap.map((cell) => (
              <div key={cell.day} className="flex flex-col items-center gap-1">
                <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600">
                  {cell.day}
                </span>
                <div
                  className="w-full aspect-square rounded-lg flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: cell.count > 0
                      ? `rgba(236, 103, 161, ${0.1 + cell.intensity * 0.6})`
                      : 'rgba(128, 128, 128, 0.05)',
                  }}
                >
                  <span
                    className="text-[10px] font-bold font-sans"
                    style={{
                      color: cell.count > 0
                        ? `rgba(236, 103, 161, ${0.5 + cell.intensity * 0.5})`
                        : 'rgba(128, 128, 128, 0.3)',
                    }}
                  >
                    {cell.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="rounded-xl border p-3 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124]">
          <h3 className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-500 dark:text-gray-500 mb-3">
            Type Breakdown
          </h3>
          <div className="space-y-2.5">
            {typeBreakdown.map((tb) => {
              const total = tb.total || 1;
              return (
                <div key={tb.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[10px] font-bold font-sans"
                      style={{ color: TASK_TYPE_COLORS[tb.type] }}
                    >
                      {tb.type}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400 dark:text-gray-600">
                      {tb.total}
                    </span>
                  </div>
                  {/* Stacked bar */}
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-[#151528] overflow-hidden flex">
                    {tb.done > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(tb.done / total) * 100}%`,
                          backgroundColor: STATUS_COLORS.DONE,
                        }}
                      />
                    )}
                    {tb.inProgress > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(tb.inProgress / total) * 100}%`,
                          backgroundColor: STATUS_COLORS.IN_PROGRESS,
                        }}
                      />
                    )}
                    {tb.pending > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(tb.pending / total) * 100}%`,
                          backgroundColor: STATUS_COLORS.PENDING,
                        }}
                      />
                    )}
                    {tb.skipped > 0 && (
                      <div
                        className="h-full"
                        style={{
                          width: `${(tb.skipped / total) * 100}%`,
                          backgroundColor: STATUS_COLORS.SKIPPED,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-3">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[key] }}
                />
                <span className="text-[7px] font-mono text-gray-400 dark:text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Section C: Master Queue Calendar ─── */}
      <div className="rounded-xl border bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124]">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#111124]">
          <h3 className="text-xs font-bold font-sans text-gray-800 dark:text-zinc-200">
            Master Queue Calendar
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-500" />
            </button>
            <span className="text-xs font-bold font-sans text-gray-700 dark:text-zinc-300 min-w-[140px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-500" />
            </button>
            <button
              onClick={() => setCalendarMonth(getMonthKey(today))}
              className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans border transition-all text-brand-mid-pink border-brand-mid-pink/30 hover:bg-brand-mid-pink/10"
            >
              Today
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-[#111124]">
          {DAY_LABELS.map((day) => (
            <div
              key={day}
              className="px-2 py-1.5 text-center text-[9px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-pulse text-xs font-mono text-gray-400 dark:text-gray-600">
              Loading calendar...
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-[#111124]">
            {calendarData.weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 divide-x divide-gray-50 dark:divide-[#111124]">
                {week.map((cell, ci) => {
                  const isToday = cell.dateKey === schedulerToday;
                  const isEmpty = cell.date === null;
                  const visibleTasks = cell.tasks.slice(0, 4);
                  const overflow = cell.tasks.length - 4;
                  const isExpanded = expandedDay === cell.dateKey;
                  // Open popover upward if in the bottom half of the calendar
                  const totalWeeks = calendarData.weeks.length;
                  const openUpward = wi >= totalWeeks / 2;

                  return (
                    <div
                      key={ci}
                      className={`relative min-h-[90px] p-1.5 transition-colors ${
                        isEmpty
                          ? 'bg-gray-50/50 dark:bg-[#07070e]/50'
                          : isToday
                            ? 'bg-brand-mid-pink/5 dark:bg-brand-mid-pink/5'
                            : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      {cell.date !== null && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[10px] font-bold font-sans ${
                                isToday
                                  ? 'text-brand-mid-pink'
                                  : 'text-gray-500 dark:text-gray-500'
                              }`}
                            >
                              {cell.date}
                            </span>
                            {cell.tasks.length > 0 && (
                              <span className="text-[8px] font-mono text-gray-300 dark:text-gray-700">
                                {cell.tasks.length}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {visibleTasks.map((task) => (
                              <TaskChip
                                key={task.id}
                                task={task}
                                onSelect={setSelectedTask}
                              />
                            ))}
                            {overflow > 0 && (
                              <button
                                onClick={() => setExpandedDay(cell.dateKey)}
                                className="text-[8px] font-mono text-brand-mid-pink hover:text-brand-light-pink px-1 hover:underline transition-colors cursor-pointer"
                              >
                                +{overflow} more
                              </button>
                            )}
                          </div>

                          {/* Expanded day popover */}
                          {isExpanded && (
                            <div
                              ref={expandedRef}
                              className={`absolute z-50 left-0 right-0 min-w-[200px] max-h-[320px] overflow-y-auto rounded-lg border shadow-xl bg-white border-gray-200 dark:bg-[#0c0c1a] dark:border-[#1a1a2e] p-2 ${
                                openUpward ? 'bottom-0' : 'top-0'
                              }`}
                              style={{ minWidth: '220px' }}
                            >
                              <div className="flex items-center justify-between mb-2 sticky top-0 bg-white dark:bg-[#0c0c1a] pb-1 border-b border-gray-100 dark:border-[#111124]">
                                <span className="text-[10px] font-bold font-sans text-gray-700 dark:text-zinc-300">
                                  {new Date(cell.dateKey + 'T00:00:00Z').toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'UTC',
                                  })}
                                  <span className="text-gray-400 dark:text-gray-600 ml-1 font-mono font-normal">
                                    ({cell.tasks.length} tasks)
                                  </span>
                                </span>
                                <button
                                  onClick={() => setExpandedDay(null)}
                                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                  <X className="h-3 w-3 text-gray-400" />
                                </button>
                              </div>
                              <div className="space-y-0.5">
                                {cell.tasks.map((task) => (
                                  <TaskChip
                                    key={task.id}
                                    task={task}
                                    onSelect={(t) => {
                                      setExpandedDay(null);
                                      setSelectedTask(t);
                                    }}
                                    showPlatformLabel
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Task Detail Modal ─── */}
      {selectedTask && (
        <SchedulerTaskModal
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          schedulerToday={schedulerToday}
          weekStart={selectedTask.weekStartDate?.toString().split('T')[0] || weekStart}
          profileName={profileName}
        />
      )}
    </div>
  );
}
