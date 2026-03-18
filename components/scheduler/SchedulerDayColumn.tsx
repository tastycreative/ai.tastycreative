'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { SchedulerTask } from '@/lib/hooks/useScheduler.query';
import { SchedulerTaskCard } from './SchedulerTaskCard';
import { getSlotForDay, DAY_NAMES } from '@/lib/scheduler/rotation';
import { getCurrentTimeDisplay, getCountdownToReset } from '@/lib/scheduler/time-helpers';

const TEAM_COLORS: Record<string, string> = {
  'Running Queue': '#4ade80',
  'Upcoming Day': '#38bdf8',
  'Flyer Team': '#c084fc',
  'Folder Team': '#fb923c',
  'Paywall Team': '#f472b6',
  'Caption Replacing': '#22d3ee',
  'Not Running': '#3a3a5a',
};

interface SchedulerDayColumnProps {
  dayIndex: number;
  date: Date;
  task: SchedulerTask | undefined;
  team: string;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  isToday: boolean;
  timeZone: string;
}

export function SchedulerDayColumn({
  dayIndex,
  date,
  task,
  team,
  onUpdate,
  isToday,
  timeZone,
}: SchedulerDayColumnProps) {
  const slotLabel = getSlotForDay(dayIndex);
  const teamColor = TEAM_COLORS[team] || '#3a3a5a';
  const isRunningQueue = team === 'Running Queue';
  const isNotRunning = team === 'Not Running';

  const [liveTime, setLiveTime] = useState('');
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (isNotRunning) return;
    const update = () => {
      if (isRunningQueue) {
        setLiveTime(getCurrentTimeDisplay(timeZone));
      } else {
        setCountdown(getCountdownToReset(new Date()));
      }
    };
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [isRunningQueue, isNotRunning, timeZone]);

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden border transition-all ${
        isToday ? '' : 'border-gray-200 dark:border-[#111124]'
      } bg-white dark:bg-[#0c0c1a]`}
      style={{
        ...(isToday && {
          borderColor: teamColor + '50',
          boxShadow: `0 0 12px ${teamColor}15`,
        }),
        opacity: isNotRunning ? 0.55 : 1,
      }}
    >
      {/* Header — day info, team name, and time tracker */}
      <div
        className={`px-3 py-2 border-b flex flex-col gap-1.5 ${
          isToday ? '' : 'bg-gray-50 border-gray-200 dark:bg-[#090912] dark:border-[#111124]'
        }`}
        style={isToday ? {
          borderColor: teamColor + '30',
          background: teamColor + '08',
        } : undefined}
      >
        {/* Row 1: Day name, slot label, date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold tracking-widest font-sans ${
                isToday ? '' : 'text-gray-400 dark:text-[#3a3a5a]'
              }`}
              style={isToday ? { color: teamColor } : undefined}
            >
              {DAY_NAMES[dayIndex]}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
              style={{
                background: teamColor + '18',
                color: teamColor,
                border: `1px solid ${teamColor}30`,
              }}
            >
              {slotLabel}
            </span>
          </div>
          <span className="text-[9px] font-mono text-gray-300 dark:text-[#252545]">
            {dateStr}
          </span>
        </div>

        {/* Row 2: Team name + DONE badge */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{
              background: teamColor,
              boxShadow: isRunningQueue ? `0 0 6px ${teamColor}` : 'none',
            }}
          />
          <span
            className="text-[10px] font-bold tracking-wide font-sans"
            style={{ color: teamColor }}
          >
            {team}
          </span>
          {task && task.status === 'DONE' && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full ml-auto font-sans bg-green-100 text-green-600 border border-green-200 dark:bg-[#4ade8018] dark:text-[#4ade80] dark:border-[#4ade8030]">
              DONE
            </span>
          )}
        </div>

        {/* Row 3: Time tracker — always rendered for consistent height */}
        <div className="flex items-center gap-1.5 min-h-[16px]">
          {isRunningQueue && liveTime && (
            <>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: teamColor }}
              />
              <span className="text-[10px] font-bold tracking-wide font-mono" style={{ color: teamColor }}>
                {liveTime}
              </span>
            </>
          )}
          {!isRunningQueue && !isNotRunning && countdown && (
            <>
              <Clock className="h-3 w-3 text-gray-400 dark:text-[#3a3a5a]" />
              <span className="text-[10px] font-mono text-gray-400 dark:text-[#3a3a5a]">
                {countdown}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Task card area */}
      <div className="p-2.5 flex-1">
        {task ? (
          <SchedulerTaskCard task={task} team={team} onUpdate={onUpdate} />
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <span className="text-[10px] italic font-mono text-gray-300 dark:text-[#1e1e35]">
              -- --
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
