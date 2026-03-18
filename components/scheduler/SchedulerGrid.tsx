'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Settings, History, Loader2, Plus } from 'lucide-react';
import {
  useSchedulerWeek,
  useSchedulerConfig,
  useUpdatePodTask,
  useSeedPodWeek,
  useCreateSchedulerTask,
  useDeleteSchedulerTask,
  SchedulerTask,
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
import { SchedulerDayColumn } from './SchedulerDayColumn';
import { SchedulerWeekNav } from './SchedulerWeekNav';
import { SchedulerPresenceBar } from './SchedulerPresenceBar';
import { SchedulerConfigModal } from './SchedulerConfigModal';
import { SchedulerActivityLog } from './SchedulerActivityLog';

// ─── Sample static tasks for demo/preview ────────────────────────────────────
function makeSampleTask(
  overrides: Partial<SchedulerTask> & { dayOfWeek: number; taskType: string },
): SchedulerTask {
  const id = `sample-${overrides.dayOfWeek}-${overrides.taskType}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    organizationId: '',
    weekStartDate: '',
    dayOfWeek: overrides.dayOfWeek,
    slotLabel: `1${String.fromCharCode(65 + overrides.dayOfWeek)}-demo`,
    team: '',
    taskName: overrides.taskName ?? '',
    taskType: overrides.taskType,
    status: overrides.status ?? 'PENDING',
    startTime: overrides.startTime ?? null,
    endTime: overrides.endTime ?? null,
    notes: overrides.notes ?? '',
    sortOrder: overrides.sortOrder ?? 0,
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function generateSampleTasks(): SchedulerTask[] {
  const samples: SchedulerTask[] = [];
  for (let day = 0; day < 7; day++) {
    // MM tasks — 5 per day
    for (let i = 0; i < 5; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'MM',
          taskName: `MM Task ${i + 1}`,
          sortOrder: i,
          status: i < 2 ? 'DONE' : i === 2 ? 'IN_PROGRESS' : 'PENDING',
        }),
      );
    }
    // WP tasks — 3 per day
    for (let i = 0; i < 3; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'WP',
          taskName: `WP Task ${i + 1}`,
          sortOrder: i,
          status: i === 0 ? 'DONE' : 'PENDING',
        }),
      );
    }
    // ST tasks — 4 per day
    for (let i = 0; i < 4; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'ST',
          taskName: `ST Task ${i + 1}`,
          sortOrder: i,
          status: i < 1 ? 'DONE' : i === 1 ? 'IN_PROGRESS' : 'PENDING',
        }),
      );
    }
    // SP tasks — 2 per day
    for (let i = 0; i < 2; i++) {
      samples.push(
        makeSampleTask({
          dayOfWeek: day,
          taskType: 'SP',
          taskName: `SP Task ${i + 1}`,
          sortOrder: i,
          status: 'PENDING',
        }),
      );
    }
  }
  return samples;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchedulerGrid() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const LA_TZ = 'America/Los_Angeles';

  const [schedulerToday, setSchedulerToday] = useState(() => getSchedulerTodayKey());

  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = getSchedulerTodayKey();
      setSchedulerToday((prev) => (prev !== newToday ? newToday : prev));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date(schedulerToday + 'T00:00:00Z');
    return formatDateKey(getWeekStart(today));
  });
  const [showConfig, setShowConfig] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  // Expanded column state (null = all normal)
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const toggleExpand = useCallback((dayIndex: number) => {
    setExpandedDay((prev) => (prev === dayIndex ? null : dayIndex));
  }, []);

  // Demo mode toggle
  const [showDemo, setShowDemo] = useState(false);
  const sampleTasks = useMemo(() => generateSampleTasks(), []);

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

  // Data
  const { data: weekData, isLoading: weekLoading } = useSchedulerWeek(weekStart);
  const { data: configData, isLoading: configLoading } = useSchedulerConfig();

  const config = configData?.config ?? null;
  const realTasks = weekData?.tasks ?? [];
  const tasks = showDemo ? sampleTasks : realTasks;
  const teamNames = config?.teamNames ?? [];
  const rotationOffset = config?.rotationOffset ?? 0;

  // Mutations
  const updateTask = useUpdatePodTask();
  const seedWeek = useSeedPodWeek();
  const createTask = useCreateSchedulerTask();
  const deleteTask = useDeleteSchedulerTask();

  // Week days
  const weekDays = useMemo(
    () => getWeekDays(new Date(weekStart + 'T00:00:00Z')),
    [weekStart],
  );

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
      if (showDemo) return; // no-op on demo tasks
      updateTask.mutate({ id, ...data, tabId });
    },
    [updateTask, showDemo],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (showDemo) return;
      deleteTask.mutate({ id, tabId });
    },
    [deleteTask, showDemo],
  );

  const handleCreateTask = useCallback(
    (dayOfWeek: number, taskType: string) => {
      if (showDemo) return;
      createTask.mutate({ weekStart, dayOfWeek, taskType, tabId });
    },
    [createTask, weekStart, showDemo],
  );

  const handleSeed = useCallback(() => {
    seedWeek.mutate({ weekStart, tabId });
  }, [seedWeek, weekStart]);

  const showSetup = !configLoading && !config;
  const isLoading = weekLoading || configLoading;

  return (
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
          {/* Type filter toggles */}
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

          {/* Demo toggle */}
          <button
            onClick={() => setShowDemo((p) => !p)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-sans border transition-all ${
              showDemo
                ? 'bg-amber-500/20 text-amber-400 border-amber-400/50'
                : 'text-gray-500 border-gray-600 opacity-50'
            }`}
            title="Toggle sample data preview"
          >
            DEMO
          </button>

          <SchedulerPresenceBar orgId={orgId} />

          {/* Seed button */}
          {!isLoading && realTasks.length === 0 && teamNames.length > 0 && !showDemo && (
            <button
              onClick={handleSeed}
              disabled={seedWeek.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all disabled:opacity-50 text-brand-blue border-brand-blue/25 bg-brand-blue/5 dark:text-[#38bdf8] dark:border-[#38bdf840] dark:bg-[#38bdf812]"
            >
              <Plus className="h-3 w-3" />
              {seedWeek.isPending ? 'GENERATING...' : 'GENERATE WEEK'}
            </button>
          )}

          {/* Setup teams button */}
          {!isLoading && teamNames.length === 0 && (
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-brand-dark-pink border-brand-dark-pink/25 bg-brand-dark-pink/5 dark:text-[#ff9a6c] dark:border-[#ff9a6c40] dark:bg-[#ff9a6c12]"
            >
              <Settings className="h-3 w-3" />
              SETUP TEAMS
            </button>
          )}

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

      {/* Week nav */}
      <SchedulerWeekNav weekStart={weekStart} todayKey={schedulerToday} onWeekChange={setWeekStart} />

      {/* Grid */}
      {isLoading && !showDemo ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-blue dark:text-[#38bdf8]" />
        </div>
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
                expanded={isExpanded}
                collapsed={!isExpanded}
                popupDirection={dayIndex > expandedDay! ? 'left' : 'right'}
                onToggleExpand={() => toggleExpand(dayIndex)}
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
                expanded={false}
                collapsed={false}
                onToggleExpand={() => toggleExpand(dayIndex)}
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
    </div>
  );
}
