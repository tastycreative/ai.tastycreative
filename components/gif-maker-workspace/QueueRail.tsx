'use client';

import { LayoutList, ChevronUp, ChevronDown } from 'lucide-react';
import type { GifQueueTicket } from '@/lib/hooks/useGifQueue.query';
import { urgencyConfig, safeUrgency } from './queue-constants';

interface QueueRailProps {
  onOpenDrawer: () => void;
  activeTicket: GifQueueTicket | null;
  queueLength: number;
  currentIndex: number;
  onPrevTask: () => void;
  onNextTask: () => void;
}

export function QueueRail({
  onOpenDrawer,
  activeTicket,
  queueLength,
  currentIndex,
  onPrevTask,
  onNextTask,
}: QueueRailProps) {
  const urgency = safeUrgency(activeTicket?.urgency ?? 'medium');
  const dotColor = urgencyConfig[urgency].dotColor;

  return (
    <div className="w-9 flex flex-col items-center py-3 gap-3 bg-white dark:bg-gray-900/80 border-r border-brand-mid-pink/20 shrink-0">
      {/* Urgency dot */}
      <div className="relative">
        <span
          className={`block w-2.5 h-2.5 rounded-full ${dotColor} ${
            urgency === 'urgent' ? 'animate-pulse' : ''
          }`}
        />
        {urgency === 'urgent' && (
          <span className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${dotColor} animate-ping opacity-50`} />
        )}
      </div>

      {/* Queue icon */}
      <button
        onClick={onOpenDrawer}
        className="p-1.5 rounded-lg hover:bg-brand-mid-pink/10 text-gray-500 dark:text-gray-400 hover:text-brand-mid-pink transition-colors"
        title="Open queue"
      >
        <LayoutList size={14} />
      </button>

      {/* Counter */}
      <div className="flex flex-col items-center text-[9px] text-gray-500 dark:text-gray-400 font-mono leading-tight">
        <span>{currentIndex + 1}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span>{queueLength}</span>
      </div>

      <div className="flex-1" />

      {/* Prev/Next */}
      <button
        onClick={onPrevTask}
        disabled={currentIndex <= 0}
        className="p-1 rounded hover:bg-brand-mid-pink/10 text-gray-500 dark:text-gray-400 hover:text-brand-mid-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Previous task"
      >
        <ChevronUp size={14} />
      </button>
      <button
        onClick={onNextTask}
        disabled={currentIndex >= queueLength - 1}
        className="p-1 rounded hover:bg-brand-mid-pink/10 text-gray-500 dark:text-gray-400 hover:text-brand-mid-pink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Next task"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
