'use client';

import { useState, useCallback, useMemo } from 'react';
import { Settings, History, Loader2, Plus } from 'lucide-react';
import {
  usePodTrackerWeek,
  usePodTrackerConfig,
  useUpdatePodTask,
  useSeedPodWeek,
  PodTrackerTask,
} from '@/lib/hooks/usePodTracker.query';
import { usePodTrackerRealtime, tabId } from '@/lib/hooks/usePodTrackerRealtime';
import { useOrganization } from '@/lib/hooks/useOrganization.query';
import { getTodayKeyInTimezone } from '@/lib/timezone-utils';
import {
  getWeekStart,
  getWeekDays,
  getTeamForDay,
  formatDateKey,
} from '@/lib/pod-tracker/rotation';
import { TrackerDayColumn } from './TrackerDayColumn';
import { TrackerWeekNav } from './TrackerWeekNav';
import { TrackerPresenceBar } from './TrackerPresenceBar';
import { TrackerConfigModal } from './TrackerConfigModal';
import { TrackerActivityLog } from './TrackerActivityLog';

export function TrackerGrid() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const LA_TZ = 'America/Los_Angeles';
  const todayKey = useMemo(() => getTodayKeyInTimezone(LA_TZ), []);

  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date(todayKey + 'T00:00:00Z');
    return formatDateKey(getWeekStart(today));
  });
  const [showConfig, setShowConfig] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  // Real-time subscription
  usePodTrackerRealtime(orgId);

  // Data
  const { data: weekData, isLoading: weekLoading } = usePodTrackerWeek(weekStart);
  const { data: configData, isLoading: configLoading } = usePodTrackerConfig();

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

  const todayStr = todayKey;

  // Map tasks by dayOfWeek — each day has one task
  const taskByDay = useMemo(() => {
    const map = new Map<number, PodTrackerTask>();
    for (const t of tasks) {
      map.set(t.dayOfWeek, t);
    }
    return map;
  }, [tasks]);

  const handleUpdate = useCallback(
    (id: string, data: Partial<PodTrackerTask>) => {
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
            <span className="text-sm font-extrabold tracking-tight font-sans text-brand-dark-pink dark:text-[#ff9a6c]">
              POD
            </span>
            <span className="text-sm font-extrabold tracking-tight font-sans text-gray-900 dark:text-zinc-300">
              Tracker
            </span>
          </div>
          <div className="w-px h-4 bg-gray-200 dark:bg-[#181828]" />
          <span className="text-[9px] tracking-wide font-mono text-gray-400 dark:text-[#252545]">
            7-day rotation · resets 5 PM LA · PST/PDT
          </span>
        </div>

        <div className="flex items-center gap-2">
          <TrackerPresenceBar orgId={orgId} />

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
      <TrackerWeekNav weekStart={weekStart} todayKey={todayKey} onWeekChange={setWeekStart} />

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
            const team = getTeamForDay(date, teamNames, todayKey, rotationOffset);
            const dateStr = formatDateKey(date);

            return (
              <TrackerDayColumn
                key={dayIndex}
                dayIndex={dayIndex}
                date={date}
                task={task}
                team={team}
                onUpdate={handleUpdate}
                isToday={dateStr === todayStr}
                timeZone={LA_TZ}
              />
            );
          })}
        </div>
      )}

      {/* Modals / Panels */}
      <TrackerConfigModal
        config={config}
        open={showConfig || showSetup}
        onClose={() => setShowConfig(false)}
      />
      <TrackerActivityLog open={showActivity} onClose={() => setShowActivity(false)} />
    </div>
  );
}
