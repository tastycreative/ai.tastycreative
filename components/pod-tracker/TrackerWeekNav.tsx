'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getWeekStart, formatDateKey } from '@/lib/pod-tracker/rotation';
import { getCountdownToReset } from '@/lib/pod-tracker/time-helpers';
import { getTimezoneAbbreviation } from '@/lib/timezone-utils';

interface TrackerWeekNavProps {
  weekStart: string;
  todayKey: string;
  onWeekChange: (weekStart: string) => void;
}

export function TrackerWeekNav({ weekStart, todayKey, onWeekChange }: TrackerWeekNavProps) {
  const [countdown, setCountdown] = React.useState('');

  React.useEffect(() => {
    const update = () => setCountdown(getCountdownToReset());
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, []);

  const ws = new Date(weekStart + 'T00:00:00Z');
  const weekEnd = new Date(ws);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const formatShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  const goPrev = () => {
    const prev = new Date(ws);
    prev.setUTCDate(prev.getUTCDate() - 7);
    onWeekChange(formatDateKey(prev));
  };

  const goNext = () => {
    const next = new Date(ws);
    next.setUTCDate(next.getUTCDate() + 7);
    onWeekChange(formatDateKey(next));
  };

  const goToday = () => {
    const today = new Date(todayKey + 'T00:00:00Z');
    onWeekChange(formatDateKey(getWeekStart(today)));
  };

  const todayWeek = formatDateKey(getWeekStart(new Date(todayKey + 'T00:00:00Z')));
  const isCurrentWeek = weekStart === todayWeek;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 px-2 py-2 border-b border-gray-200 dark:border-[#111124]">
      <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400 dark:text-[#3a3a5a]" />
        </button>

        <div className="text-center min-w-[160px]">
          <span className="text-xs font-bold font-sans text-gray-900 dark:text-zinc-300">
            {formatShort(ws)} — {formatShort(weekEnd)}
          </span>
        </div>

        <button
          onClick={goNext}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-[#3a3a5a]" />
        </button>

        {!isCurrentWeek && (
          <button
            onClick={goToday}
            className="text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-colors font-sans text-brand-dark-pink border-brand-dark-pink/25 bg-brand-dark-pink/5 dark:text-[#ff9a6c] dark:border-[#ff9a6c40] dark:bg-[#ff9a6c12]"
          >
            TODAY
          </button>
        )}
      </div>

      {/* Reset countdown */}
      {countdown && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-brand-mid-pink dark:bg-[#f472b6]" />
          <span className="text-[10px] font-mono text-gray-400 dark:text-[#3a3a5a]">
            resets in {countdown} (5 PM {getTimezoneAbbreviation('America/Los_Angeles', new Date())})
          </span>
        </div>
      )}
    </div>
  );
}
