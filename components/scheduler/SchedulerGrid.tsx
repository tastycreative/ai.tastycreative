'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Settings, History, Loader2, Plus } from 'lucide-react';
import {
  useSchedulerWeek,
  useSchedulerConfig,
  useUpdatePodTask,
  useSeedPodWeek,
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
import { SchedulerDayColumn } from './SchedulerDayColumn';
import { SchedulerWeekNav } from './SchedulerWeekNav';
import { SchedulerPresenceBar } from './SchedulerPresenceBar';
import { SchedulerConfigModal } from './SchedulerConfigModal';
import { SchedulerActivityLog } from './SchedulerActivityLog';

export function SchedulerGrid() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const LA_TZ = 'America/Los_Angeles';

  // Scheduler "today" advances at 5 PM LA, not midnight.
  // Re-check every 30s so rotation auto-updates when reset happens.
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

  // Real-time subscription
  useSchedulerRealtime(orgId);

  // Data
  const { data: weekData, isLoading: weekLoading } = useSchedulerWeek(weekStart);
  const { data: configData, isLoading: configLoading } = useSchedulerConfig();

  const config = configData?.config ?? null;
  const tasks = weekData?.tasks ?? [];
  const teamNames = config?.teamNames ?? [];
  const rotationOffset = config?.rotationOffset ?? 0;

  // Mutations
  const updateTask = useUpdatePodTask();
  const seedWeek = useSeedPodWeek();

  // Week days
  const weekDays = useMemo(
    () => getWeekDays(new Date(weekStart + 'T00:00:00Z')),
    [weekStart],
  );

  // Map tasks by dayOfWeek — each day has one task
  const taskByDay = useMemo(() => {
    const map = new Map<number, SchedulerTask>();
    for (const t of tasks) {
      map.set(t.dayOfWeek, t);
    }
    return map;
  }, [tasks]);

  const handleUpdate = useCallback(
    (id: string, data: Partial<SchedulerTask>) => {
      updateTask.mutate({ id, ...data, tabId });
    },
    [updateTask],
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
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-extrabold tracking-tight font-sans text-brand-dark-pink dark:text-brand-light-pink">
              Scheduler
            </span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />
          <span className="text-[9px] tracking-wide font-mono text-gray-400 dark:text-[#252545]">
            7-day rotation · resets 5 PM LA · PST/PDT
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SchedulerPresenceBar orgId={orgId} />

          {/* Seed button */}
          {!isLoading && tasks.length === 0 && teamNames.length > 0 && (
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
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-blue dark:text-[#38bdf8]" />
        </div>
      ) : (
        <div
          className="grid gap-2 p-2 flex-1 overflow-x-auto"
          style={{ gridTemplateColumns: 'repeat(7, minmax(160px, 1fr))' }}
        >
          {weekDays.map((date, dayIndex) => {
            const task = taskByDay.get(dayIndex);
            const team = getTeamForDay(date, teamNames, schedulerToday, rotationOffset);
            const dateStr = formatDateKey(date);

            return (
              <SchedulerDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                date={date}
                task={task}
                team={team}
                onUpdate={handleUpdate}
                isToday={dateStr === schedulerToday}
                timeZone={LA_TZ}
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
