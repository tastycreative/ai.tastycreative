'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useSchedulerActivity } from '@/lib/hooks/useScheduler.query';

interface SchedulerActivityLogProps {
  open: boolean;
  onClose: () => void;
}

export function SchedulerActivityLog({ open, onClose }: SchedulerActivityLogProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useSchedulerActivity();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!open) return null;

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return createPortal(
    <div className="fixed inset-y-0 right-0 z-40 w-80 flex flex-col shadow-2xl bg-white border-l border-gray-200 dark:bg-[#0b0b1a] dark:border-[#111124]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#111124]">
        <h3 className="text-xs font-bold tracking-wide font-sans text-gray-900 dark:text-zinc-300">
          Activity Log
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5">
          <X className="h-3.5 w-3.5 text-gray-400 dark:text-[#555]" />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-brand-blue dark:text-[#38bdf8]" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <p className="text-xs text-center py-10 font-mono text-gray-400 dark:text-[#3a3a5a]">
            No activity yet.
          </p>
        )}

        {items.map((item) => {
          const hasChanges = item.changes && item.changes.length > 0;
          const isExpanded = expanded.has(item.id);

          return (
            <div
              key={item.id}
              className="px-4 py-3 border-b transition-colors border-gray-100 hover:bg-gray-50 dark:border-[#0c0c1f] dark:hover:bg-white/[0.02]"
            >
              <div className="flex items-start gap-2">
                {item.user.imageUrl ? (
                  <img src={item.user.imageUrl} alt="" className="h-5 w-5 rounded-full flex-shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full flex-shrink-0 bg-brand-light-pink/10 dark:bg-[#ff9a6c20]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-gray-500 dark:text-[#888]">
                    <span className="font-bold text-gray-700 dark:text-[#aaa]">
                      {item.user.name || 'Unknown'}
                    </span>{' '}
                    {item.summary}
                  </p>
                  <p className="text-[9px] mt-0.5 font-mono text-gray-300 dark:text-[#252545]">
                    {new Date(item.createdAt).toLocaleString('en-US', {
                      timeZone: 'America/Los_Angeles',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>

                  {/* Expandable changes */}
                  {hasChanges && (
                    <button
                      onClick={() => toggleExpanded(item.id)}
                      className="flex items-center gap-0.5 mt-1 text-[9px] font-mono text-brand-blue dark:text-[#38bdf8] hover:underline"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-2.5 w-2.5" />
                      ) : (
                        <ChevronRight className="h-2.5 w-2.5" />
                      )}
                      {item.changes.length} change{item.changes.length !== 1 ? 's' : ''}
                    </button>
                  )}
                  {hasChanges && isExpanded && (
                    <div className="mt-1.5 space-y-1 pl-1 border-l-2 border-gray-200 dark:border-[#1a1a35]">
                      {item.changes.map((c) => (
                        <div key={c.id} className="text-[9px] font-mono text-gray-400 dark:text-[#666]">
                          <span className="text-gray-600 dark:text-[#888]">{c.field}</span>:{' '}
                          {c.oldValue && (
                            <span className="line-through text-red-400/70 dark:text-red-400/50">{c.oldValue}</span>
                          )}
                          {c.oldValue && c.newValue && ' → '}
                          {c.newValue && (
                            <span className="text-green-600 dark:text-green-400/70">{c.newValue}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {hasNextPage && (
          <div className="px-4 py-3 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-[10px] font-bold font-sans text-brand-blue dark:text-[#38bdf8]"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
