'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Settings, History, CalendarClock, Download, Upload, ChevronDown, ChevronLeft, ChevronRight, Copy, Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  useSchedulerWeek,
  useSchedulerConfig,
  useUpdatePodTask,
  useCreateSchedulerTask,
  useDeleteSchedulerTask,
  useUpdateTaskLimits,
  useTaskStreaks,
  getTaskStreak,
  SchedulerTask,
  TaskLimits,
} from '@/lib/hooks/useScheduler.query';
import { useSchedulerRealtime, tabId } from '@/lib/hooks/useSchedulerRealtime';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import {
  getWeekStart,
  getWeekDays,
  getTeamForDay,
  formatDateKey,
  getSchedulerTodayKey,
} from '@/lib/scheduler/rotation';
import { TASK_TYPES, TASK_TYPE_COLORS } from './SchedulerTaskCard';
import { cleanTaskLimits } from '@/lib/scheduler/task-limits';
import { SchedulerDayColumn } from './SchedulerDayColumn';
import { SchedulerPresenceBar } from './SchedulerPresenceBar';
import { SchedulerPresenceProvider } from './SchedulerPresenceContext';
import { SchedulerWeekNav } from './SchedulerWeekNav';
import { SchedulerConfigModal } from './SchedulerConfigModal';
import { SchedulerActivityLog } from './SchedulerActivityLog';
import { SchedulerHistoryCalendar } from './SchedulerHistoryCalendar';
import { SchedulerImportModal } from './SchedulerImportModal';
import { SchedulerExportModal } from './SchedulerExportModal';
import { SchedulerDashboard, SchedulerCalendar } from './SchedulerDashboard';
import { SchedulerWorkspace } from './SchedulerWorkspace';
import { useInstagramProfile } from '@/hooks/useInstagramProfile';
import { type VolumeSettings, getStrategyVolumeTemplate } from '@/lib/scheduler/strategy-volume-templates';
import { useSchedulerUrlParams } from '@/hooks/useSchedulerUrlParams';

// ─── Page strategy label map ─────────────────────────────────────────────────
const STRATEGY_LABELS: Record<string, string> = {
  gf_experience: 'GF Experience',
  porn_accurate: 'Porn Accurate',
  tease_denial: 'Tease & Denial',
  premium_exclusive: 'Premium Exclusive',
  girl_next_door: 'Girl Next Door',
  domme: 'Domme',
};

// ─── Platform tabs ───────────────────────────────────────────────────────────
const PLATFORM_TABS = [
  { key: 'free', label: 'Free', color: '#4ade80' },
  { key: 'paid', label: 'Paid', color: '#f472b6' },
  { key: 'oftv', label: 'OFTV', color: '#38bdf8' },
  { key: 'fansly', label: 'Fansly', color: '#c084fc' },
] as const;

type PlatformKey = 'dashboard' | 'calendar' | 'workspace' | (typeof PLATFORM_TABS)[number]['key'];

const VALID_PLATFORM_KEYS = new Set<string>([
  'dashboard', 'calendar', 'workspace', ...PLATFORM_TABS.map((t) => t.key),
]);

// ─── Skeleton Loader ─────────────────────────────────────────────────────────

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-[#151528] ${className}`} />;
}

function SkeletonDayColumn({ isToday }: { isToday?: boolean }) {
  return (
    <div
      className={`flex flex-col rounded-xl border overflow-hidden ${
        isToday
          ? 'border-brand-blue/30 dark:border-[#38bdf8]/20'
          : 'border-gray-200 dark:border-[#111124]'
      } bg-white dark:bg-[#0a0a14]`}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100 dark:border-[#111124]">
        <div className="flex items-center justify-between mb-1.5">
          <SkeletonPulse className="h-3.5 w-10" />
          <SkeletonPulse className="h-3 w-14" />
        </div>
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-3 w-12" />
          <SkeletonPulse className="h-4 w-16 rounded-full" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-3 py-1.5">
        <SkeletonPulse className="h-1 w-full rounded-full" />
      </div>

      {/* Task cards */}
      <div className="flex-1 px-2 pb-2 space-y-1.5">
        {['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2'].map((w, i) => (
          <div key={i} className="rounded-lg border border-gray-100 dark:border-[#111124] p-2">
            <div className="flex items-center gap-2">
              <SkeletonPulse className="h-2 w-2 rounded-full shrink-0" />
              <SkeletonPulse className="h-2.5 w-8 rounded-full shrink-0" />
              <SkeletonPulse className={`h-2.5 ${w}`} />
            </div>
            {i % 2 === 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 ml-4">
                <SkeletonPulse className="h-2 w-12" />
                <SkeletonPulse className="h-2 w-8" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-[#111124]">
        <SkeletonPulse className="h-5 w-full rounded-md" />
      </div>
    </div>
  );
}

function SchedulerGridSkeleton() {
  return (
    <div
      className="grid gap-2 p-2 flex-1 overflow-x-auto"
      style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <SkeletonDayColumn key={i} isToday={i === 2} />
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchedulerGrid() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const LA_TZ = 'America/Los_Angeles';
  const { profileId: currentProfileId, selectedProfile, isAllProfiles, loadingProfiles, profiles, setProfileId } = useInstagramProfile();
  const { params: urlParams, setParams: setUrlParams, pushParams } = useSchedulerUrlParams();

  // ─── URL → initial profile sync (once profiles are loaded) ────────────
  // If ?model= is in the URL, we must resolve it before rendering the grid.
  const hasUrlModel = !!urlParams.model;
  const [profileSynced, setProfileSynced] = useState(!hasUrlModel); // instantly resolved if no URL model
  const profileSyncedRef = useRef(!hasUrlModel);
  useEffect(() => {
    if (profileSyncedRef.current || loadingProfiles) return;
    if (!urlParams.model) {
      setProfileSynced(true);
      profileSyncedRef.current = true;
      return;
    }
    const target = urlParams.model.toLowerCase();
    const match = profiles.find((p) => p.name.toLowerCase() === target);
    if (match) {
      setProfileId(match.id);
    }
    profileSyncedRef.current = true;
    setProfileSynced(true);
  }, [loadingProfiles, profiles, urlParams.model, setProfileId]);

  // Platform tab state — read from URL or default to dashboard
  const [activePlatform, setActivePlatformRaw] = useState<PlatformKey>(() => {
    const urlPlatform = urlParams.platform?.toLowerCase();
    if (urlPlatform && VALID_PLATFORM_KEYS.has(urlPlatform)) return urlPlatform as PlatformKey;
    return 'dashboard';
  });

  // Wrap setActivePlatform to sync → URL
  const setActivePlatform = useCallback(
    (p: PlatformKey) => {
      setActivePlatformRaw(p);
      setUrlParams({ platform: p === 'dashboard' ? null : p, task: null });
    },
    [setUrlParams],
  );

  // Fetch full profile details (page strategy, content types)
  const profileId = selectedProfile && !isAllProfiles ? selectedProfile.id : null;
  const { data: profileDetail } = useQuery<{
    pageStrategy?: string;
    selectedContentTypes?: string[];
    customStrategies?: { id: string; label: string; desc: string }[];
    customContentTypes?: string[];
    metadata?: { volumeSettings?: VolumeSettings };
  }>({
    queryKey: ['instagram-profile-detail', profileId],
    queryFn: async () => {
      const res = await fetch(`/api/instagram-profiles/${profileId}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const [showContentTypes, setShowContentTypes] = useState(false);
  const contentTypesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contentTypesRef.current && !contentTypesRef.current.contains(e.target as Node)) {
        setShowContentTypes(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [schedulerToday, setSchedulerToday] = useState(() => getSchedulerTodayKey());

  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = getSchedulerTodayKey();
      setSchedulerToday((prev) => (prev !== newToday ? newToday : prev));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const [weekStart, setWeekStartRaw] = useState(() => {
    // Try URL param first
    if (urlParams.week) {
      const parsed = new Date(urlParams.week + 'T00:00:00Z');
      if (!isNaN(parsed.getTime())) return formatDateKey(getWeekStart(parsed));
    }
    const today = new Date(schedulerToday + 'T00:00:00Z');
    return formatDateKey(getWeekStart(today));
  });

  // Wrap setWeekStart to sync → URL
  const setWeekStart = useCallback(
    (ws: string) => {
      setWeekStartRaw(ws);
      setUrlParams({ week: ws });
    },
    [setUrlParams],
  );


  const [showConfig, setShowConfig] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Expanded column state (null = all normal)
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const toggleExpand = useCallback((dayIndex: number) => {
    setExpandedDay((prev) => (prev === dayIndex ? null : dayIndex));
  }, []);

  // Type filter state
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    () => new Set(TASK_TYPES),
  );

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Real-time
  useSchedulerRealtime(orgId);

  // Data — wait for profile selector to resolve before fetching
  const profileReady = isAllProfiles || !loadingProfiles;
  const activeProfileId = selectedProfile && !isAllProfiles ? selectedProfile.id : null;
  const isDashboard = activePlatform === 'dashboard';
  const isCalendar = activePlatform === 'calendar';
  const isWorkspace = activePlatform === 'workspace';
  const [workspaceSubTab, setWorkspaceSubTab] = useState<'flagged' | 'missing-amount'>('flagged');
  const { data: weekData, isLoading: weekLoading } = useSchedulerWeek(
    weekStart,
    activeProfileId,
    isDashboard || isCalendar || isWorkspace ? undefined : activePlatform,
    profileReady && !isDashboard && !isCalendar && !isWorkspace,
  );
  const { data: configData, isLoading: configLoading } = useSchedulerConfig();

  const config = configData?.config ?? null;
  const realTasks = weekData?.tasks ?? [];
  const tasks = realTasks;
  const { data: streaksData } = useTaskStreaks(tasks);
  const teamNames = config?.teamNames ?? [];
  const rotationOffset = config?.rotationOffset ?? 0;
  const taskLimits = config?.taskLimits ?? null;

  // Merge profile-level volume settings over org-level task limits.
  // Priority (per platform+type): scheduler manual overrides > profile volumeSettings > strategy template > org defaults
  const effectiveTaskLimits = useMemo<TaskLimits | null>(() => {
    const profileVolume = profileDetail?.metadata?.volumeSettings;
    const strategyTemplate = profileDetail?.pageStrategy
      ? getStrategyVolumeTemplate(profileDetail.pageStrategy)
      : null;
    const volumeOverride = profileVolume ?? strategyTemplate;
    if (!volumeOverride) return taskLimits;

    // Deep-merge: start with strategy/profile volume as base, then layer org overrides on top
    const orgPlatformDefaults = taskLimits?.platformDefaults ?? {};
    const mergedPlatformDefaults: Record<string, Record<string, number>> = {};
    const allPlatforms = new Set([...Object.keys(volumeOverride), ...Object.keys(orgPlatformDefaults)]);
    for (const platform of allPlatforms) {
      mergedPlatformDefaults[platform] = {
        ...(volumeOverride[platform] ?? {}),       // strategy/profile as base
        ...(orgPlatformDefaults[platform] ?? {}),   // scheduler manual overrides win
      };
    }

    return {
      defaults: taskLimits?.defaults ?? {},
      overrides: taskLimits?.overrides ?? {},
      platformDefaults: mergedPlatformDefaults,
    };
  }, [taskLimits, profileDetail?.metadata?.volumeSettings, profileDetail?.pageStrategy]);

  // ─── Sync profile name → URL (after initial sync) ──────────────────────
  const prevSyncedProfileId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loadingProfiles || !profileSyncedRef.current) return;
    const isFirst = prevSyncedProfileId.current === undefined;
    // Skip if profile hasn't actually changed
    if (!isFirst && prevSyncedProfileId.current === currentProfileId) return;
    prevSyncedProfileId.current = currentProfileId;

    const name = selectedProfile && !isAllProfiles ? selectedProfile.name : null;
    // On first run: just set model (preserve task param from URL).
    // On subsequent changes: set model and clear task.
    if (isFirst) {
      setUrlParams({ model: name });
    } else {
      setUrlParams({ model: name, task: null });
    }
  }, [currentProfileId, selectedProfile, isAllProfiles, loadingProfiles, setUrlParams]);

  // ─── Task modal URL sync ──────────────────────────────────────────────
  const urlTaskSlot = urlParams.task;
  const autoOpenTaskId = useMemo(() => {
    if (!urlTaskSlot) return null;
    const found = realTasks.find((t) => t.slotLabel === urlTaskSlot);
    return found?.id ?? null;
  }, [urlTaskSlot, realTasks]);

  // Show toast if task param is set but not found after data loads
  const taskNotFoundToasted = useRef(false);
  useEffect(() => {
    if (!urlTaskSlot || weekLoading) {
      taskNotFoundToasted.current = false;
      return;
    }
    if (!autoOpenTaskId && realTasks.length > 0 && !taskNotFoundToasted.current) {
      taskNotFoundToasted.current = true;
      toast.error('Task not found in this week');
      setUrlParams({ task: null });
    }
  }, [urlTaskSlot, autoOpenTaskId, realTasks, weekLoading, setUrlParams]);

  const openTaskInUrl = useCallback(
    (slotLabel: string) => pushParams({ task: slotLabel }),
    [pushParams],
  );

  const clearTaskParam = useCallback(
    () => setUrlParams({ task: null }),
    [setUrlParams],
  );

  // Mutations
  const updateTask = useUpdatePodTask();
  const createTask = useCreateSchedulerTask();
  const deleteTask = useDeleteSchedulerTask();
  const updateTaskLimits = useUpdateTaskLimits();
  // Week days
  const weekDays = useMemo(
    () => getWeekDays(new Date(weekStart + 'T00:00:00Z')),
    [weekStart],
  );

  // Is the currently displayed week the one containing "today"?
  const isCurrentWeek = useMemo(() => {
    const todayWeekStart = formatDateKey(getWeekStart(new Date(schedulerToday + 'T00:00:00Z')));
    return weekStart === todayWeekStart;
  }, [weekStart, schedulerToday]);

  // Auto-advance weekStart when schedulerToday crosses into a new week
  // (e.g., 5 PM PDT Saturday → Sunday = new week)
  const prevSchedulerTodayRef = useRef(schedulerToday);
  useEffect(() => {
    const prev = prevSchedulerTodayRef.current;
    prevSchedulerTodayRef.current = schedulerToday;
    if (prev === schedulerToday) return;
    // Only auto-advance if the user was viewing the week that contained the old "today"
    const oldWeek = formatDateKey(getWeekStart(new Date(prev + 'T00:00:00Z')));
    const newWeek = formatDateKey(getWeekStart(new Date(schedulerToday + 'T00:00:00Z')));
    if (oldWeek !== newWeek && weekStart === oldWeek) {
      setWeekStartRaw(newWeek);
      setUrlParams({ week: newWeek });
    }
  }, [schedulerToday, weekStart, setUrlParams]);

  // Map tasks by day, filtered by active types, sorted by type group then sortOrder
  const tasksByDay = useMemo(() => {
    const map = new Map<number, SchedulerTask[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);

    for (const t of tasks) {
      if (t.taskType && !activeTypes.has(t.taskType)) continue;
      const arr = map.get(t.dayOfWeek);
      if (arr) arr.push(t);
    }

    const typeOrder = Object.fromEntries(TASK_TYPES.map((t, i) => [t, i]));
    for (const [, dayTasks] of map) {
      dayTasks.sort((a, b) => {
        const typeA = typeOrder[a.taskType] ?? 999;
        const typeB = typeOrder[b.taskType] ?? 999;
        if (typeA !== typeB) return typeA - typeB;
        return a.sortOrder - b.sortOrder;
      });
    }

    return map;
  }, [tasks, activeTypes]);

  const handleUpdate = useCallback(
    (id: string, data: Partial<SchedulerTask>) => {
      updateTask.mutate({ id, ...data, tabId });

      // ── Bidirectional sync: Unlock ↔ Follow up (contentPreview + style) ──
      if (data.fields) {
        const updatedFields = data.fields as Record<string, string>;
        const hasContentSync = updatedFields.contentPreview !== undefined;
        const hasStyleSync = updatedFields.subType !== undefined;
        if (!hasContentSync && !hasStyleSync) return;

        const task = tasks.find((t) => t.id === id);
        if (!task || task.taskType !== 'MM') return;

        const taskTypeName = (
          (task.fields as Record<string, string> | null)?.type || task.taskName || ''
        ).toLowerCase();
        const isUnlock = taskTypeName.includes('unlock');
        const isFollowUp = taskTypeName.includes('follow up') || taskTypeName.includes('follow-up');

        if (!isUnlock && !isFollowUp) return;

        // Build the patch to apply to siblings
        const syncPatch: Record<string, string> = {};
        if (hasContentSync) syncPatch.contentPreview = updatedFields.contentPreview;
        if (hasStyleSync) syncPatch.subType = updatedFields.subType;

        const dayTasks = tasksByDay.get(task.dayOfWeek) ?? [];
        const mmTasks = dayTasks.filter((t) => t.taskType === 'MM');
        const taskIdx = mmTasks.findIndex((t) => t.id === id);
        if (taskIdx < 0) return;

        if (isUnlock) {
          // Unlock → sync forward to Follow up(s)
          for (let i = taskIdx + 1; i < mmTasks.length; i++) {
            const next = mmTasks[i];
            const nextFields = (next.fields || {}) as Record<string, string>;
            const nextType = (nextFields.type || next.taskName || '').toLowerCase();

            if (nextType.includes('follow up') || nextType.includes('follow-up')) {
              const merged = { ...nextFields, ...syncPatch };
              updateTask.mutate({ id: next.id, fields: merged as SchedulerTask['fields'], tabId });
            } else if (nextType.includes('unlock')) {
              break;
            }
          }
        } else if (isFollowUp) {
          // Follow up → sync backward to the preceding Unlock
          for (let i = taskIdx - 1; i >= 0; i--) {
            const prev = mmTasks[i];
            const prevFields = (prev.fields || {}) as Record<string, string>;
            const prevType = (prevFields.type || prev.taskName || '').toLowerCase();

            if (prevType.includes('unlock')) {
              const merged = { ...prevFields, ...syncPatch };
              updateTask.mutate({ id: prev.id, fields: merged as SchedulerTask['fields'], tabId });
              // Also sync to any other Follow ups under that same Unlock
              for (let j = i + 1; j < mmTasks.length; j++) {
                const sibling = mmTasks[j];
                if (sibling.id === id) continue; // skip self
                const sibFields = (sibling.fields || {}) as Record<string, string>;
                const sibType = (sibFields.type || sibling.taskName || '').toLowerCase();
                if (sibType.includes('follow up') || sibType.includes('follow-up')) {
                  const sibMerged = { ...sibFields, ...syncPatch };
                  updateTask.mutate({ id: sibling.id, fields: sibMerged as SchedulerTask['fields'], tabId });
                } else if (sibType.includes('unlock')) {
                  break;
                }
              }
              break;
            }
          }
        }
      }
    },
    [updateTask, tasks, tasksByDay],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteTask.mutate({ id, tabId });
    },
    [deleteTask],
  );

  const handleCreateTask = useCallback(
    (dayOfWeek: number, taskType: string, initialFields?: import('@/lib/hooks/useScheduler.query').TaskFields, lineageId?: string | null) => {
      return createTask.mutateAsync({
        weekStart,
        dayOfWeek,
        taskType,
        fields: initialFields,
        platform: activePlatform,
        profileId: activeProfileId,
        tabId,
        ...(lineageId ? { lineageId } : {}),
      });
    },
    [createTask, weekStart, activePlatform, activeProfileId],
  );

  const handleUpdateTaskLimits = useCallback(
    (dayIndex: number, type: string, newMax: number | null, platform?: string) => {
      const current: TaskLimits = taskLimits
        ? {
            defaults: { ...taskLimits.defaults },
            overrides: { ...taskLimits.overrides },
            ...(taskLimits.platformDefaults && {
              platformDefaults: Object.fromEntries(
                Object.entries(taskLimits.platformDefaults).map(([k, v]) => [k, { ...v }]),
              ),
            }),
          }
        : { defaults: {}, overrides: {} };

      if (dayIndex === -1 && platform) {
        // Update per-platform defaults (from dashboard)
        if (!current.platformDefaults) current.platformDefaults = {};
        if (!current.platformDefaults[platform]) current.platformDefaults[platform] = {};
        if (newMax === null) {
          const { [type]: _, ...rest } = current.platformDefaults[platform];
          current.platformDefaults[platform] = rest;
        } else {
          current.platformDefaults[platform][type] = newMax;
        }
      } else if (dayIndex === -1) {
        // Update global defaults
        if (newMax === null) {
          const { [type]: _, ...rest } = current.defaults;
          current.defaults = rest;
        } else {
          current.defaults[type] = newMax;
        }
      } else {
        const dayKey = String(dayIndex);
        if (newMax === null) {
          if (current.overrides[dayKey]) {
            const { [type]: _, ...rest } = current.overrides[dayKey];
            if (Object.keys(rest).length > 0) {
              current.overrides[dayKey] = rest;
            } else {
              const { [dayKey]: __, ...restOverrides } = current.overrides;
              current.overrides = restOverrides;
            }
          }
        } else {
          current.overrides[dayKey] = { ...(current.overrides[dayKey] ?? {}), [type]: newMax };
        }
      }

      const cleaned = cleanTaskLimits(current);
      const hasAny =
        Object.keys(cleaned.defaults).length > 0 ||
        Object.keys(cleaned.overrides).length > 0 ||
        Object.keys(cleaned.platformDefaults ?? {}).length > 0;
      updateTaskLimits.mutate({ taskLimits: hasAny ? cleaned : null, tabId });
    },
    [taskLimits, updateTaskLimits],
  );

  // Batch save all platform limits at once (from dashboard popover)
  const handleSavePlatformLimits = useCallback(
    (platform: string, typeLimits: Record<string, number>) => {
      const current: TaskLimits = taskLimits
        ? {
            defaults: { ...taskLimits.defaults },
            overrides: { ...taskLimits.overrides },
            ...(taskLimits.platformDefaults && {
              platformDefaults: Object.fromEntries(
                Object.entries(taskLimits.platformDefaults).map(([k, v]) => [k, { ...v }]),
              ),
            }),
          }
        : { defaults: {}, overrides: {} };

      if (!current.platformDefaults) current.platformDefaults = {};
      // Replace entire platform entry with new values
      if (Object.keys(typeLimits).length > 0) {
        current.platformDefaults[platform] = typeLimits;
      } else {
        delete current.platformDefaults[platform];
      }

      // Clear any day-level overrides for types that now have platform defaults
      // so the platform defaults apply to ALL days consistently
      for (const [dayKey, dayOverrides] of Object.entries(current.overrides)) {
        const filtered: Record<string, number> = {};
        for (const [type, value] of Object.entries(dayOverrides)) {
          // Keep override only if this type is NOT being set by the platform default
          if (!(type in typeLimits)) {
            filtered[type] = value;
          }
        }
        if (Object.keys(filtered).length > 0) {
          current.overrides[dayKey] = filtered;
        } else {
          delete current.overrides[dayKey];
        }
      }

      const cleaned = cleanTaskLimits(current);
      const hasAny =
        Object.keys(cleaned.defaults).length > 0 ||
        Object.keys(cleaned.overrides).length > 0 ||
        Object.keys(cleaned.platformDefaults ?? {}).length > 0;
      updateTaskLimits.mutate({ taskLimits: hasAny ? cleaned : null, tabId });
    },
    [taskLimits, updateTaskLimits],
  );

  // ── Clone to next week (server-side via /api/scheduler/clone-week) ──────
  // dayIndex = specific day, or -1 = whole week
  const [cloningDay, setCloningDay] = useState<number | null>(null);
  const [cloningWeek, setCloningWeek] = useState(false);

  const handleCloneToNextWeek = useCallback(
    async (dayIndex: number) => {
      if (cloningDay !== null || cloningWeek) return;
      const isWholeWeek = dayIndex === -1;
      if (isWholeWeek) setCloningWeek(true);
      else setCloningDay(dayIndex);

      try {
        // Compute next week's start date
        const ws = new Date(weekStart + 'T00:00:00Z');
        ws.setUTCDate(ws.getUTCDate() + 7);
        const targetWeekStart = ws.toISOString().split('T')[0];

        // Fire-and-forget to server — progress comes via Ably to all users
        const res = await fetch('/api/scheduler/clone-week', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceWeekStart: weekStart,
            targetWeekStart,
            profileId: activeProfileId || undefined,
            platform: !isDashboard && !isCalendar ? activePlatform : undefined,
            days: isWholeWeek ? undefined : [dayIndex],
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error('Clone failed', { description: err.error || 'Server error' });
        }
        // Success toast comes from Ably clone.complete event in useSchedulerRealtime
      } catch (err) {
        console.error('Clone to next week failed:', err);
        toast.error('Clone failed', { description: 'Network error' });
      } finally {
        setCloningDay(null);
        setCloningWeek(false);
      }
    },
    [weekStart, activeProfileId, activePlatform, isDashboard, isCalendar, cloningDay, cloningWeek],
  );

  // ── Clone flags only (to a user-selected week) ──────────────────────────
  const [showCloneMenu, setShowCloneMenu] = useState(false);
  const [showCloneFlagsPicker, setShowCloneFlagsPicker] = useState(false);
  const [cloneFlagsTarget, setCloneFlagsTarget] = useState<string>(() => {
    // Default to next week
    const ws = new Date(weekStart + 'T00:00:00Z');
    ws.setUTCDate(ws.getUTCDate() + 7);
    return ws.toISOString().split('T')[0];
  });
  const [cloningFlags, setCloningFlags] = useState(false);
  const cloneMenuRef = useRef<HTMLDivElement>(null);

  // Close clone menu on outside click
  useEffect(() => {
    if (!showCloneMenu && !showCloneFlagsPicker) return;
    const handler = (e: MouseEvent) => {
      if (cloneMenuRef.current && !cloneMenuRef.current.contains(e.target as Node)) {
        setShowCloneMenu(false);
        setShowCloneFlagsPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCloneMenu, showCloneFlagsPicker]);

  // Reset target week when source week changes
  useEffect(() => {
    const ws = new Date(weekStart + 'T00:00:00Z');
    ws.setUTCDate(ws.getUTCDate() + 7);
    setCloneFlagsTarget(ws.toISOString().split('T')[0]);
  }, [weekStart]);

  const handleCloneFlags = useCallback(async () => {
    if (cloningFlags) return;
    setCloningFlags(true);
    try {
      const res = await fetch('/api/scheduler/clone-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWeekStart: weekStart,
          targetWeekStart: cloneFlagsTarget,
          profileId: activeProfileId || undefined,
          platform: !isDashboard && !isCalendar ? activePlatform : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('Clone flags failed', { description: data.error || 'Server error' });
      } else if (data.updated === 0) {
        toast.info(data.message || 'No flags to clone');
      } else {
        toast.success(`Flagged ${data.updated} task(s) in target week`);
      }
    } catch (err) {
      console.error('Clone flags failed:', err);
      toast.error('Clone flags failed', { description: 'Network error' });
    } finally {
      setCloningFlags(false);
      setShowCloneFlagsPicker(false);
      setShowCloneMenu(false);
    }
  }, [weekStart, cloneFlagsTarget, activeProfileId, activePlatform, isDashboard, isCalendar, cloningFlags]);

  const showSetup = !configLoading && !config;
  const isLoading = weekLoading || configLoading || !profileReady;

  // Gate: if URL has ?model= but profile hasn't synced yet, show skeleton
  if (!profileSynced) {
    return (
      <div className="flex flex-col h-full rounded-xl overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#07070e] dark:text-zinc-300">
        <div className="px-4 py-3 border-b flex items-center gap-3 bg-white border-gray-200 dark:bg-[#090912] dark:border-[#111122]">
          <span className="text-sm font-extrabold tracking-tight font-sans text-brand-dark-pink dark:text-brand-light-pink">
            Scheduler
          </span>
        </div>
        <SchedulerGridSkeleton />
      </div>
    );
  }

  return (
    <SchedulerPresenceProvider profileId={activeProfileId}>
    <div className="flex flex-col h-full rounded-xl overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#07070e] dark:text-zinc-300">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-3 bg-white border-gray-200 dark:bg-[#090912] dark:border-[#111122]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-extrabold tracking-tight font-sans text-brand-dark-pink dark:text-brand-light-pink">
            Scheduler
          </span>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />
          <span className="text-[9px] tracking-wide font-mono text-gray-400 dark:text-[#252545]">
            7-day rotation · resets 5 PM LA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Type filter toggles — only on platform tabs */}
          {!isDashboard && !isCalendar && !isWorkspace && (
            <div className="flex items-center gap-1 mr-2">
              {TASK_TYPES.map((type) => {
                const color = TASK_TYPE_COLORS[type];
                const isActive = activeTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans transition-all border"
                    style={{
                      background: isActive ? color + '25' : 'transparent',
                      color: isActive ? color : '#555',
                      borderColor: isActive ? color + '50' : '#333',
                      opacity: isActive ? 1 : 0.5,
                    }}
                    title={`${isActive ? 'Hide' : 'Show'} ${type} tasks`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          )}

          <SchedulerPresenceBar />


          {/* Setup teams button */}
          {/* {!isLoading && teamNames.length === 0 && (
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-brand-dark-pink border-brand-dark-pink/25 bg-brand-dark-pink/5 dark:text-[#ff9a6c] dark:border-[#ff9a6c40] dark:bg-[#ff9a6c12]"
            >
              <Settings className="h-3 w-3" />
              SETUP TEAMS
            </button>
          )} */}

          <button
            onClick={() => setShowHistory(true)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Change History"
          >
            <CalendarClock className="h-3.5 w-3.5 text-gray-400 dark:text-[#3a3a5a]" />
          </button>
          <button
            onClick={() => setShowActivity(true)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Activity Log"
          >
            <History className="h-3.5 w-3.5 text-gray-400 dark:text-[#3a3a5a]" />
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5 text-gray-400 dark:text-[#3a3a5a]" />
          </button>
        </div>
      </div>

      {/* Selected profile + platform tabs row */}
      {selectedProfile && !isAllProfiles && (
        <div className="px-4 py-2 border-b flex items-center gap-3 bg-white/50 border-gray-200 dark:bg-[#090912]/50 dark:border-[#111122]">
          {/* Profile name */}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold font-sans text-gray-800 dark:text-zinc-200 truncate">
              {selectedProfile.name}
            </span>
            {selectedProfile.instagramUsername && (
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600 truncate">
                @{selectedProfile.instagramUsername}
              </span>
            )}
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-[#181828]" />

          {/* Platform tabs */}
          <div className="flex items-center gap-1">
            {/* Dashboard tab */}
            <button
              onClick={() => setActivePlatform('dashboard')}
              className="text-[10px] font-bold px-3 py-1 rounded-full font-sans transition-all border"
              style={{
                background: isDashboard
                  ? 'linear-gradient(135deg, rgba(236,103,161,0.2), rgba(93,195,248,0.2))'
                  : 'transparent',
                color: isDashboard ? '#EC67A1' : '#888',
                borderColor: isDashboard ? 'rgba(236,103,161,0.5)' : 'transparent',
              }}
            >
              Dashboard
            </button>
            {/* Calendar tab */}
            <button
              onClick={() => setActivePlatform('calendar')}
              className="text-[10px] font-bold px-3 py-1 rounded-full font-sans transition-all border"
              style={{
                background: isCalendar
                  ? 'linear-gradient(135deg, rgba(236,103,161,0.2), rgba(93,195,248,0.2))'
                  : 'transparent',
                color: isCalendar ? '#EC67A1' : '#888',
                borderColor: isCalendar ? 'rgba(236,103,161,0.5)' : 'transparent',
              }}
            >
              Calendar
            </button>
            {/* Workspace tab */}
            <button
              onClick={() => setActivePlatform('workspace')}
              className="text-[10px] font-bold px-3 py-1 rounded-full font-sans transition-all border"
              style={{
                background: isWorkspace
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(244,63,94,0.2))'
                  : 'transparent',
                color: isWorkspace ? '#f59e0b' : '#888',
                borderColor: isWorkspace ? 'rgba(245,158,11,0.5)' : 'transparent',
              }}
            >
              Workspace
            </button>
            <div className="w-px h-3.5 bg-gray-200 dark:bg-[#181828] mx-0.5" />
            {PLATFORM_TABS.map((tab) => {
              const isActive = activePlatform === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActivePlatform(tab.key)}
                  className="text-[10px] font-bold px-3 py-1 rounded-full font-sans transition-all border"
                  style={{
                    background: isActive ? tab.color + '20' : 'transparent',
                    color: isActive ? tab.color : '#888',
                    borderColor: isActive ? tab.color + '50' : 'transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: strategy + content types + import */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Page Strategy */}
            {profileDetail?.pageStrategy && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                {(() => {
                  const label = STRATEGY_LABELS[profileDetail.pageStrategy!];
                  if (label) return label;
                  const custom = profileDetail.customStrategies?.find(s => s.id === profileDetail.pageStrategy);
                  return custom?.label ?? profileDetail.pageStrategy;
                })()}
              </span>
            )}

            {/* Content Types */}
            {profileDetail?.selectedContentTypes && profileDetail.selectedContentTypes.length > 0 && (
              <div className="relative" ref={contentTypesRef}>
                <button
                  onClick={() => setShowContentTypes(p => !p)}
                  className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full font-sans bg-purple-500/10 text-purple-400 border border-purple-500/20 transition-colors hover:bg-purple-500/20"
                >
                  {profileDetail.selectedContentTypes.length} CONTENT TYPE{profileDetail.selectedContentTypes.length !== 1 ? 'S' : ''}
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showContentTypes ? 'rotate-180' : ''}`} />
                </button>
                {showContentTypes && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#0c0c1a] border border-gray-200 dark:border-[#1a1a2e] rounded-lg shadow-xl p-2 min-w-[180px] max-w-[260px]">
                    <div className="flex flex-wrap gap-1">
                      {profileDetail.selectedContentTypes.map(ct => (
                        <span
                          key={ct}
                          className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        >
                          {ct}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import, Export, Clone — only on platform tabs */}
            {!isDashboard && !isCalendar && !isWorkspace && (
              <>
                <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />

                {/* Import button */}
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700 dark:text-gray-500 dark:border-[#252545] dark:hover:border-[#3a3a5a] dark:hover:text-gray-300"
                >
                  <Download className="h-3 w-3" />
                  IMPORT
                </button>

                {/* Export button */}
                <button
                  onClick={() => setShowExport(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-700 dark:text-gray-500 dark:border-[#252545] dark:hover:border-[#3a3a5a] dark:hover:text-gray-300"
                >
                  <Upload className="h-3 w-3" />
                  EXPORT
                </button>

                <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />

                {/* Clone dropdown — Clone Week or Clone Flags */}
                <div className="relative" ref={cloneMenuRef}>
                  <button
                    onClick={() => setShowCloneMenu((v) => !v)}
                    disabled={cloningWeek || cloningFlags}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-purple-500 border-purple-400/30 hover:border-purple-400/60 hover:bg-purple-500/5 dark:text-purple-400 dark:border-purple-500/25 dark:hover:border-purple-400/50 dark:hover:bg-purple-500/10 disabled:opacity-50"
                  >
                    <Copy className="h-3 w-3" />
                    {cloningWeek ? 'CLONING...' : cloningFlags ? 'CLONING FLAGS...' : 'CLONE'}
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {/* Dropdown menu */}
                  {showCloneMenu && !showCloneFlagsPicker && (
                    <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border bg-white dark:bg-[#0e0e1a] border-gray-200 dark:border-[#252545] shadow-xl z-50 py-1">
                      <button
                        onClick={() => { setShowCloneMenu(false); handleCloneToNextWeek(-1); }}
                        disabled={cloningWeek}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200">Clone Week</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-500">Clone all tasks to next week</div>
                        </div>
                      </button>
                      <div className="h-px bg-gray-100 dark:bg-[#1a1a2e] mx-2" />
                      <button
                        onClick={() => setShowCloneFlagsPicker(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <Flag className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        <div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200">Clone Flags Only</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-500">Copy flagged status to another week</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Clone flags — week picker */}
                  {showCloneFlagsPicker && (
                    <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border bg-white dark:bg-[#0e0e1a] border-gray-200 dark:border-[#252545] shadow-xl z-50 p-3">
                      <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Flag className="h-3 w-3 text-amber-500" />
                        Clone Flags to Week
                      </div>
                      {/* Week selector */}
                      <div className="flex items-center justify-between gap-1 mb-3">
                        <button
                          onClick={() => {
                            const d = new Date(cloneFlagsTarget + 'T00:00:00Z');
                            d.setUTCDate(d.getUTCDate() - 7);
                            setCloneFlagsTarget(d.toISOString().split('T')[0]);
                          }}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <ChevronLeft className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 text-center">
                          {(() => {
                            const ws = new Date(cloneFlagsTarget + 'T00:00:00Z');
                            const we = new Date(ws);
                            we.setUTCDate(we.getUTCDate() + 6);
                            const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
                            return `${fmt(ws)} — ${fmt(we)}`;
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            const d = new Date(cloneFlagsTarget + 'T00:00:00Z');
                            d.setUTCDate(d.getUTCDate() + 7);
                            setCloneFlagsTarget(d.toISOString().split('T')[0]);
                          }}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      </div>
                      {/* Same-week warning */}
                      {cloneFlagsTarget === weekStart && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-2">
                          Target week is the same as the current week.
                        </p>
                      )}
                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowCloneFlagsPicker(false); setShowCloneMenu(false); }}
                          className="flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium text-gray-500 border-gray-200 dark:border-[#252545] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCloneFlags}
                          disabled={cloningFlags || cloneFlagsTarget === weekStart}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {cloningFlags ? 'Cloning...' : 'Clone Flags'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Week navigation — only on platform tabs */}
      {!isDashboard && !isCalendar && !isWorkspace && (
        <SchedulerWeekNav
          weekStart={weekStart}
          todayKey={schedulerToday}
          onWeekChange={setWeekStart}
        />
      )}

      {/* Grid / Dashboard */}
      {!profileReady ? (
        <SchedulerGridSkeleton />
      ) : isDashboard ? (
        <SchedulerDashboard
          profileId={activeProfileId}
          schedulerToday={schedulerToday}
          weekStart={weekStart}
          onSwitchPlatform={(p) => setActivePlatform(p as PlatformKey)}
          onSwitchToWorkspace={(subtab) => {
            setWorkspaceSubTab(subtab);
            setActivePlatform('workspace');
          }}
          taskLimits={effectiveTaskLimits}
          onSavePlatformLimits={handleSavePlatformLimits}
          profileName={selectedProfile?.name}
          profileImageUrl={selectedProfile?.profileImageUrl}
          instagramUsername={selectedProfile?.instagramUsername}
          pageStrategy={profileDetail?.pageStrategy}
          selectedContentTypes={profileDetail?.selectedContentTypes}
        />
      ) : isWorkspace ? (
        <SchedulerWorkspace
          profileId={activeProfileId}
          schedulerToday={schedulerToday}
          weekStart={weekStart}
          profileName={selectedProfile?.name}
          defaultTab={workspaceSubTab}
        />
      ) : isCalendar ? (
        <SchedulerCalendar
          profileId={activeProfileId}
          schedulerToday={schedulerToday}
          profileName={selectedProfile?.name}
        />
      ) : isLoading ? (
        <SchedulerGridSkeleton />
      ) : expandedDay !== null ? (
        /* ── Expanded layout: horizontal row, strips overlap like fanned cards ── */
        <div className="flex flex-1 overflow-visible p-2 items-stretch">
          {weekDays.map((date, dayIndex) => {
            const dayTasks = tasksByDay.get(dayIndex) ?? [];
            const team = getTeamForDay(date, teamNames, schedulerToday, rotationOffset);
            const dateStr = formatDateKey(date);
            const isExpanded = dayIndex === expandedDay;

            return (
              <SchedulerDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                date={date}
                tasks={dayTasks}
                team={team}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateTask={handleCreateTask}
                isToday={dateStr === schedulerToday}
                timeZone={LA_TZ}
                weekStart={weekStart}
                schedulerToday={schedulerToday}
                expanded={isExpanded}
                collapsed={!isExpanded}
                popupDirection={dayIndex > expandedDay! ? 'left' : 'right'}
                onToggleExpand={() => toggleExpand(dayIndex)}
                taskLimits={effectiveTaskLimits}
                onUpdateTaskLimits={handleUpdateTaskLimits}
                platform={activePlatform}
                profileId={activeProfileId}
                profileName={selectedProfile?.name}
                onCloneToNextWeek={handleCloneToNextWeek}
                cloning={cloningDay !== null || cloningWeek}
                autoOpenTaskId={autoOpenTaskId}
                onTaskModalOpen={openTaskInUrl}
                onTaskModalClose={clearTaskParam}
                isCurrentWeek={isCurrentWeek}
                streaks={streaksData}
              />
            );
          })}
        </div>
      ) : (
        /* ── Normal grid: all columns equal ── */
        <div
          className="grid gap-2 p-2 flex-1 overflow-x-auto"
          style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}
        >
          {weekDays.map((date, dayIndex) => {
            const dayTasks = tasksByDay.get(dayIndex) ?? [];
            const team = getTeamForDay(date, teamNames, schedulerToday, rotationOffset);
            const dateStr = formatDateKey(date);

            return (
              <SchedulerDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                date={date}
                tasks={dayTasks}
                team={team}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateTask={handleCreateTask}
                isToday={dateStr === schedulerToday}
                timeZone={LA_TZ}
                weekStart={weekStart}
                schedulerToday={schedulerToday}
                expanded={false}
                collapsed={false}
                onToggleExpand={() => toggleExpand(dayIndex)}
                taskLimits={effectiveTaskLimits}
                onUpdateTaskLimits={handleUpdateTaskLimits}
                platform={activePlatform}
                profileId={activeProfileId}
                profileName={selectedProfile?.name}
                onCloneToNextWeek={handleCloneToNextWeek}
                cloning={cloningDay !== null || cloningWeek}
                autoOpenTaskId={autoOpenTaskId}
                onTaskModalOpen={openTaskInUrl}
                onTaskModalClose={clearTaskParam}
                isCurrentWeek={isCurrentWeek}
                streaks={streaksData}
              />
            );
          })}
        </div>
      )}

      {/* Modals / Panels */}
      <SchedulerConfigModal
        config={config}
        open={showConfig || showSetup}
        onClose={() => setShowConfig(false)}
      />
      <SchedulerActivityLog open={showActivity} onClose={() => setShowActivity(false)} />
      <SchedulerHistoryCalendar
        open={showHistory}
        onClose={() => setShowHistory(false)}
        profileId={activeProfileId}
        platform={activePlatform}
      />
      <SchedulerImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        weekStart={weekStart}
        platform={activePlatform}
        profileId={activeProfileId}
      />
      <SchedulerExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        weekStart={weekStart}
        platform={activePlatform}
        profileId={activeProfileId}
        profileName={selectedProfile?.name ?? 'Schedule'}
        weekDays={weekDays}
        tasksByDay={tasksByDay}
      />
    </div>
    </SchedulerPresenceProvider>
  );
}
