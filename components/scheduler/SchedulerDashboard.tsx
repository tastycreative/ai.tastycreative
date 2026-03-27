'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Zap, Eye, Settings2, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useSchedulerMonth,
  SchedulerTask,
  useUpdatePodTask,
  TaskLimits,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS, TASK_TYPES } from './task-cards/shared';
import { SchedulerTaskModal } from './SchedulerTaskModal';
import { tabId } from '@/lib/hooks/useSchedulerRealtime';
import { getCurrentTimeDisplay } from '@/lib/scheduler/time-helpers';

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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STRATEGY_LABELS: Record<string, string> = {
  gf_experience: 'GF Experience',
  porn_accurate: 'Porn Accurate',
  tease_denial: 'Tease & Denial',
  premium_exclusive: 'Premium Exclusive',
  girl_next_door: 'Girl Next Door',
  domme: 'Domme',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface SchedulerDashboardProps {
  profileId: string | null;
  schedulerToday: string;
  weekStart: string;
  onSwitchPlatform: (platform: string) => void;
  taskLimits?: TaskLimits | null;
  onSavePlatformLimits?: (platform: string, typeLimits: Record<string, number>) => void;
  profileName?: string;
  profileImageUrl?: string;
  instagramUsername?: string;
  pageStrategy?: string;
  selectedContentTypes?: string[];
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

function parsePriceString(price: string | undefined | null): number {
  if (!price) return 0;
  const cleaned = price.replace(/[$,]/g, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'free') return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseTimeString(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function getCurrentLAMinutes(): number {
  const now = new Date();
  const laTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).format(now);
  const [h, m] = laTime.split(':').map(Number);
  return h * 60 + m;
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

// ─── Profile Initials Avatar ─────────────────────────────────────────────────

function ProfileAvatar({ name, imageUrl, size = 80 }: { name?: string; imageUrl?: string; size?: number }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (imageUrl) {
    return (
      <div
        className="rounded-full overflow-hidden border-2 border-brand-mid-pink/30 shrink-0"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name || 'Profile'}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center bg-brand-mid-pink/15 border-2 border-brand-mid-pink/30 shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-lg font-bold font-sans text-brand-mid-pink">{initials}</span>
    </div>
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

  // Check if any limits are configured for this platform
  const platLimits = taskLimits?.platformDefaults?.[platform];
  const hasLimits = platLimits && Object.values(platLimits).some((v) => v > 0);

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
        className={`p-0.5 rounded transition-colors ${
          hasLimits
            ? 'hover:bg-brand-mid-pink/10 text-brand-mid-pink'
            : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-gray-600'
        }`}
        title="Set volume per type"
      >
        <Settings2 className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl border bg-white border-gray-200 dark:bg-[#0c0c1a] dark:border-[#1a1a2e] p-3 min-w-[180px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[9px] font-bold font-sans text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-2">
            Volume Per Type
          </div>
          <div className="space-y-2">
            {(TASK_TYPES as readonly string[]).map((type) => {
              const color = TASK_TYPE_COLORS[type] || '#3a3a5a';
              const val = localValues[type] || '';
              const hasLimit = val !== '' && val !== '0';
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold font-sans w-6" style={{ color }}>
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
            Set volume per type per day. Clear to remove.
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
  profileImageUrl,
  instagramUsername,
  pageStrategy,
  selectedContentTypes,
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

  // ─── LA time (ticks every second — drives both clock display and spotlight) ───
  const [laTimeDisplay, setLaTimeDisplay] = useState(() => getCurrentTimeDisplay('America/Los_Angeles'));
  const [currentLAMinutes, setCurrentLAMinutes] = useState(getCurrentLAMinutes);

  useEffect(() => {
    const interval = setInterval(() => {
      setLaTimeDisplay(getCurrentTimeDisplay('America/Los_Angeles'));
      setCurrentLAMinutes(getCurrentLAMinutes());
    }, 1_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Today's tasks ───
  const todayTasks = useMemo(() => {
    return tasks.filter((t) => getTaskDate(t) === schedulerToday);
  }, [tasks, schedulerToday]);

  // ─── Platform summary (today only) ───
  const platformSummary = useMemo(() => {
    const platforms = ['free', 'paid', 'oftv', 'fansly'];
    return platforms.map((p) => {
      const pTasks = todayTasks.filter((t) => t.platform === p);
      const total = pTasks.length;
      const pending = pTasks.filter((t) => t.status === 'PENDING').length;
      const inProgress = pTasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const done = pTasks.filter((t) => t.status === 'DONE').length;
      const skipped = pTasks.filter((t) => t.status === 'SKIPPED').length;
      const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
      const typeCounts = (TASK_TYPES as readonly string[]).map((type) => ({
        type,
        count: pTasks.filter((t) => t.taskType === type && t.status !== 'DONE' && t.status !== 'SKIPPED').length,
      }));
      return { key: p, total, pending, inProgress, done, skipped, completionPct, typeCounts };
    });
  }, [todayTasks]);

  // ─── Today's completion ───
  const todayCompletion = useMemo(() => {
    const total = todayTasks.length;
    const done = todayTasks.filter((t) => t.status === 'DONE').length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [todayTasks]);

  // ─── MM Revenue ───
  const mmRevenue = useMemo(() => {
    const [year, mon] = calendarMonth.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();

    const mmWithPrice = tasks.filter((t) => {
      if (t.taskType !== 'MM') return false;
      const f = (t.fields || {}) as Record<string, string>;
      if (!f.price || !f.price.trim()) return false;
      // Only count locked (past) tasks or tasks marked DONE
      const taskDate = getTaskDate(t);
      const isLocked = taskDate < schedulerToday;
      return isLocked || t.status === 'DONE';
    });

    let totalRevenue = 0;
    const byPlatform: Record<string, { revenue: number; count: number }> = {};
    const dailyMap: Record<string, number> = {};

    for (const t of mmWithPrice) {
      const f = (t.fields || {}) as Record<string, string>;
      const amount = parsePriceString(f.price);
      totalRevenue += amount;

      if (!byPlatform[t.platform]) byPlatform[t.platform] = { revenue: 0, count: 0 };
      byPlatform[t.platform].revenue += amount;
      byPlatform[t.platform].count += 1;

      const dateKey = getTaskDate(t);
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + amount;
    }

    const dailyChartData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateKey = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { date: dateKey, label: String(day), revenue: dailyMap[dateKey] || 0 };
    });

    const tasksWithRevenue = mmWithPrice.filter(
      (t) => parsePriceString(((t.fields || {}) as Record<string, string>).price) > 0,
    ).length;

    return {
      totalRevenue,
      totalTasks: mmWithPrice.length,
      tasksWithRevenue,
      avgPerTask: tasksWithRevenue > 0 ? totalRevenue / tasksWithRevenue : 0,
      byPlatform,
      dailyChartData,
    };
  }, [tasks, calendarMonth, schedulerToday]);

  // ─── Current task spotlight ───
  const { spotlightTask, upNextTasks } = useMemo(() => {
    const withTime = todayTasks
      .map((t) => ({
        task: t,
        minutes: parseTimeString(getTaskTime(t)),
      }))
      .filter((t) => t.minutes !== null)
      .sort((a, b) => a.minutes! - b.minutes!);

    if (withTime.length === 0) return { spotlightTask: null, upNextTasks: [] };

    const nowMinutes = currentLAMinutes;
    const nextIdx = withTime.findIndex((t) => t.minutes! >= nowMinutes);

    let spotlightIdx: number;
    if (nextIdx === -1) {
      spotlightIdx = withTime.length - 1;
    } else {
      spotlightIdx = nextIdx;
    }

    const spotlight = withTime[spotlightIdx].task;
    const upcoming = withTime.slice(spotlightIdx + 1).map((t) => t.task).slice(0, 3);
    return { spotlightTask: spotlight, upNextTasks: upcoming };
  }, [todayTasks, currentLAMinutes]);

  // ─── Calendar data ───
  const calendarData = useMemo(() => {
    const [year, mon] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, mon - 1, 1));
    const lastDay = new Date(Date.UTC(year, mon, 0));
    const daysInMonth = lastDay.getUTCDate();
    const startDow = firstDay.getUTCDay();

    const taskMap = new Map<string, SchedulerTask[]>();
    for (const t of tasks) {
      const dateKey = getTaskDate(t);
      if (!taskMap.has(dateKey)) taskMap.set(dateKey, []);
      taskMap.get(dateKey)!.push(t);
    }

    const weeks: { date: number | null; dateKey: string; tasks: SchedulerTask[] }[][] = [];
    let currentWeek: { date: number | null; dateKey: string; tasks: SchedulerTask[] }[] = [];

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

  // ─── Spotlight content preview ───
  const spotlightFields = spotlightTask
    ? ((spotlightTask.fields || {}) as Record<string, string>)
    : {};
  const spotlightPreviewUrl =
    spotlightFields.contentPreview || spotlightFields.contentFlyer || '';
  const spotlightCaption =
    spotlightFields.captionBankText || spotlightFields.caption || '';
  const spotlightTypeColor = spotlightTask
    ? TASK_TYPE_COLORS[spotlightTask.taskType] || '#888'
    : '#888';

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* ─── Section A: Profile Card + Today's Stats ─── */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Left: Profile Card */}
        <div className="lg:w-1/4 rounded-xl border p-4 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124] flex flex-col items-center text-center gap-2">
          <ProfileAvatar name={profileName} imageUrl={profileImageUrl} size={80} />
          <div>
            <div className="text-sm font-bold font-sans text-gray-800 dark:text-zinc-200">
              {profileName || 'No Profile'}
            </div>
            {instagramUsername && (
              <div className="text-[10px] font-mono text-gray-400 dark:text-gray-600">
                @{instagramUsername}
              </div>
            )}
          </div>
          {/* Strategy badge */}
          {pageStrategy && (
            <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full font-sans bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
              {STRATEGY_LABELS[pageStrategy] || pageStrategy}
            </span>
          )}
          {/* Content type pills */}
          {selectedContentTypes && selectedContentTypes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {selectedContentTypes.map((ct) => (
                <span
                  key={ct}
                  className="text-[8px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                >
                  {ct}
                </span>
              ))}
            </div>
          )}
          {/* Active badge */}
          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        </div>

        {/* Right: Today's Overview */}
        <div className="lg:w-3/4 flex flex-col gap-3">
          {/* Platform summary cards */}
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
                    {p.total} today
                  </span>
                  {onSavePlatformLimits && (
                    <LimitsPopover
                      platform={p.key}
                      taskLimits={taskLimits}
                      onSave={onSavePlatformLimits}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  {p.typeCounts
                    .filter((tc) => tc.count > 0)
                    .map((tc) => (
                      <TypeCountBadge key={tc.type} type={tc.type} count={tc.count} />
                    ))}
                  {p.total === 0 && (
                    <span className="text-[8px] font-mono text-gray-300 dark:text-gray-700">
                      No tasks today
                    </span>
                  )}
                </div>
                {/* Configured limits indicator */}
                {(() => {
                  const platLimits = taskLimits?.platformDefaults?.[p.key];
                  const activeLimits = platLimits
                    ? (TASK_TYPES as readonly string[])
                        .filter((type) => platLimits[type] && platLimits[type] > 0)
                        .map((type) => [type, platLimits[type]] as [string, number])
                    : [];
                  if (activeLimits.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                      <span className="text-[7px] font-mono text-gray-400 dark:text-gray-600">volume:</span>
                      {activeLimits.map(([type, limit]) => {
                        const color = TASK_TYPE_COLORS[type] || '#3a3a5a';
                        return (
                          <span
                            key={type}
                            className="text-[7px] font-mono px-1 rounded"
                            style={{ color, background: color + '10' }}
                          >
                            {limit} {type}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2 text-[9px] font-mono mb-2">
                  <span style={{ color: STATUS_COLORS.PENDING }}>{p.pending} pending</span>
                  <span style={{ color: STATUS_COLORS.IN_PROGRESS }}>{p.inProgress} active</span>
                  <span style={{ color: STATUS_COLORS.DONE }}>{p.done} done</span>
                  <span style={{ color: STATUS_COLORS.SKIPPED }}>{p.skipped} skip</span>
                </div>
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

          {/* Today's completion donut */}
          <div className="rounded-xl border p-3 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124] flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="currentColor"
                  className="text-gray-100 dark:text-[#151528]"
                  strokeWidth="10"
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#EC67A1"
                  strokeWidth="10"
                  strokeDasharray={`${(todayCompletion.pct / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                  strokeLinecap="round"
                  opacity={todayCompletion.total > 0 ? 0.85 : 0.15}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-bold font-sans text-gray-800 dark:text-zinc-200">
                  {todayCompletion.pct}%
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-500 dark:text-gray-500">
                Today&apos;s Completion
              </h3>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-0.5">
                {todayCompletion.done} of {todayCompletion.total} tasks done
              </p>
              <div className="flex items-center gap-2 mt-1">
                {platformSummary
                  .filter((p) => p.total > 0)
                  .map((p) => (
                    <div key={p.key} className="flex items-center gap-1">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[p.key] }}
                      />
                      <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600">
                        {PLATFORM_LABELS[p.key]} {p.done}/{p.total}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] font-mono text-gray-400 dark:text-gray-600">LA Time</div>
              <div className="text-xs font-bold font-mono text-brand-mid-pink">{laTimeDisplay}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MM Revenue Section ─── */}
      {mmRevenue.totalTasks > 0 && (
        <div className="rounded-xl border p-4 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124] space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-bold font-sans text-gray-800 dark:text-zinc-200">
                MM Revenue — {monthLabel}
              </h3>
            </div>
            <span className="text-sm font-bold font-mono text-emerald-500">
              ${mmRevenue.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Stat badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ${mmRevenue.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {mmRevenue.tasksWithRevenue} paid tasks
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-purple-500/10 text-purple-400 border border-purple-500/20">
              ${mmRevenue.avgPerTask.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} avg/task
            </span>
          </div>

          {/* Platform breakdown */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(mmRevenue.byPlatform).map(([platform, data]) => (
              <div key={platform} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLORS[platform] || '#888' }}
                />
                <span className="text-[9px] font-bold font-sans text-gray-600 dark:text-gray-400">
                  {PLATFORM_LABELS[platform] || platform}
                </span>
                <span className="text-[9px] font-mono text-emerald-500">
                  ${data.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600">
                  ({data.count})
                </span>
              </div>
            ))}
          </div>

          {/* Daily bar chart */}
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mmRevenue.dailyChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-[#151528]" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 8, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const val = payload[0].value as number;
                    return (
                      <div className="rounded-lg border px-2.5 py-1.5 shadow-lg text-xs bg-white border-gray-200 dark:bg-[#0c0c1a] dark:border-[#1a1a2e]">
                        <div className="font-sans font-bold text-gray-700 dark:text-zinc-300">Day {label}</div>
                        <div className="font-mono text-emerald-500">
                          ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" fill="#4ade80" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Section B: Current Task Spotlight ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-brand-mid-pink" />
          <h3 className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-500 dark:text-gray-500">
            Current Task
          </h3>
        </div>

        {spotlightTask ? (
          <button
            onClick={() => setSelectedTask(spotlightTask)}
            className="w-full text-left rounded-xl border p-4 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124] transition-all hover:shadow-md hover:border-brand-mid-pink/30 dark:hover:border-brand-mid-pink/20"
            style={{ borderLeftWidth: '4px', borderLeftColor: spotlightTypeColor }}
          >
            <div className="flex items-start gap-4">
              {/* Left: content preview */}
              {spotlightPreviewUrl &&
                spotlightPreviewUrl.startsWith('http') && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-[#151528] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spotlightPreviewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              {/* Right: task info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {/* Type badge */}
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans"
                    style={{
                      background: spotlightTypeColor + '18',
                      color: spotlightTypeColor,
                      border: `1px solid ${spotlightTypeColor + '30'}`,
                    }}
                  >
                    {spotlightTask.taskType}
                  </span>
                  {/* Platform badge */}
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans uppercase"
                    style={{
                      background: (PLATFORM_COLORS[spotlightTask.platform] || '#888') + '18',
                      color: PLATFORM_COLORS[spotlightTask.platform] || '#888',
                      border: `1px solid ${(PLATFORM_COLORS[spotlightTask.platform] || '#888') + '30'}`,
                    }}
                  >
                    {PLATFORM_LABELS[spotlightTask.platform] || spotlightTask.platform}
                  </span>
                  {/* Status badge */}
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans"
                    style={{
                      background: (STATUS_COLORS[spotlightTask.status] || '#888') + '18',
                      color: STATUS_COLORS[spotlightTask.status] || '#888',
                      border: `1px solid ${(STATUS_COLORS[spotlightTask.status] || '#888') + '30'}`,
                    }}
                  >
                    {spotlightTask.status.replace('_', ' ')}
                  </span>
                </div>
                {/* Time */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-sm font-bold font-mono text-gray-800 dark:text-zinc-200">
                    {getTaskTime(spotlightTask) || 'No time'}
                  </span>
                </div>
                {/* Label */}
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {getTaskLabel(spotlightTask)}
                </p>
                {/* Caption preview */}
                {spotlightCaption && (
                  <p className="text-[10px] font-mono text-gray-400 dark:text-gray-600 line-clamp-2">
                    {spotlightCaption}
                  </p>
                )}
              </div>
              {/* Click hint */}
              <div className="shrink-0 self-center">
                <Eye className="h-4 w-4 text-gray-300 dark:text-gray-700" />
              </div>
            </div>
          </button>
        ) : (
          <div className="rounded-xl border p-6 bg-white border-gray-200 dark:bg-[#0a0a14] dark:border-[#111124] text-center">
            <p className="text-xs font-mono text-gray-400 dark:text-gray-600">
              No tasks scheduled for today
            </p>
          </div>
        )}

        {/* Up Next row */}
        {upNextTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-600">
                Up Next
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {upNextTasks.map((task) => (
                <div key={task.id} className="shrink-0 w-[220px]">
                  <TaskChip task={task} onSelect={setSelectedTask} showPlatformLabel />
                </div>
              ))}
            </div>
          </div>
        )}
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
