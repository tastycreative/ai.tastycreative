'use client';

import React, { useMemo } from 'react';
import { Calendar, Check } from 'lucide-react';
import { getWeekStart, getWeekDays, formatDateKey } from '@/lib/scheduler/rotation';

interface WeekPickerProps {
  /** Current scheduler today key (YYYY-MM-DD) */
  schedulerToday: string;
  /** lineageId tasks already exist for (to show dots on weeks) */
  existingWeekStarts?: Set<string>;
  /** Called when a week is selected */
  onSelectWeek: (weekStart: string, dayOfWeek: number) => void;
  /** The source task's dayOfWeek (carried over) */
  sourceDayOfWeek: number;
  onClose: () => void;
}

export function WeekPicker({
  schedulerToday,
  existingWeekStarts,
  onSelectWeek,
  sourceDayOfWeek,
  onClose,
}: WeekPickerProps) {
  const weeks = useMemo(() => {
    const today = new Date(schedulerToday + 'T00:00:00Z');
    const currentWeekStart = getWeekStart(today);

    // Show next 8 weeks starting from the week after current
    const result: { weekStart: string; label: string; hasExisting: boolean }[] = [];
    for (let i = 1; i <= 8; i++) {
      const ws = new Date(currentWeekStart);
      ws.setUTCDate(ws.getUTCDate() + i * 7);
      const wsKey = formatDateKey(ws);
      const days = getWeekDays(ws);
      const startLabel = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const endLabel = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      result.push({
        weekStart: wsKey,
        label: `${startLabel} — ${endLabel}`,
        hasExisting: existingWeekStarts?.has(wsKey) || false,
      });
    }
    return result;
  }, [schedulerToday, existingWeekStarts]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-1 mb-2">
        <Calendar className="h-3 w-3 text-brand-blue" />
        <span className="text-[10px] font-bold font-sans text-gray-600 dark:text-gray-400">
          Select target week
        </span>
      </div>
      {weeks.map((week) => (
        <button
          key={week.weekStart}
          onClick={() => {
            onSelectWeek(week.weekStart, sourceDayOfWeek);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-brand-blue/10 dark:hover:bg-brand-blue/5 group"
        >
          <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300 group-hover:text-brand-blue flex-1">
            {week.label}
          </span>
          {week.hasExisting && (
            <span className="flex items-center gap-1 text-[8px] font-bold font-sans px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25">
              <Check className="h-2.5 w-2.5" />
              QUEUED
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
