'use client';

import { memo } from 'react';

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700/50 rounded ${className}`} />
  );
}

/** Skeleton card mimicking a board task card */
function CardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="p-3 rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/40 space-y-2.5"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Title line */}
      <Skeleton className="h-3.5 w-4/5" />
      {/* Description line */}
      <Skeleton className="h-3 w-3/5" />
      {/* Tags row */}
      <div className="flex gap-1.5 pt-1">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Footer row: avatar + date */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Skeleton column mimicking a kanban column */
function ColumnSkeleton({ cardCount, index }: { cardCount: number; index: number }) {
  return (
    <div
      className="w-72 shrink-0 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700/30 bg-gray-50 dark:bg-gray-900/40"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Column header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-4 w-6 rounded" />
          </div>
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </div>
      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-hidden">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} index={i} />
        ))}
      </div>
    </div>
  );
}

/** Full board skeleton with multiple columns */
export const BoardSkeleton = memo(function BoardSkeleton() {
  // Vary card counts per column for a natural look
  const columns = [4, 3, 2, 3, 1];

  return (
    <div className="flex gap-4 p-4 overflow-hidden h-full">
      {columns.map((cardCount, i) => (
        <ColumnSkeleton key={i} cardCount={cardCount} index={i} />
      ))}
    </div>
  );
});

/** Compact skeleton for task detail modal sidebar */
export const TaskDetailSkeleton = memo(function TaskDetailSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Title */}
      <Skeleton className="h-5 w-3/4" />
      {/* Status row */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        ))}
      </div>
      {/* Description */}
      <div className="pt-2 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
});
