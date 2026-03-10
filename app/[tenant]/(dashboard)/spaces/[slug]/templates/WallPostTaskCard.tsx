'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import {
  Pencil,
  Check,
  X,
  Clock,
  User,
  Calendar,
  AtSign,
} from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import type { BoardTaskCardProps } from '../../board/BoardTaskCard';

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  awaitingCaption: { color: 'bg-gray-400', label: 'Awaiting' },
  pending: { color: 'bg-amber-400', label: 'Pending' },
  submitted: { color: 'bg-brand-blue', label: 'Submitted' },
  approved: { color: 'bg-emerald-400', label: 'Approved' },
  rejected: { color: 'bg-red-400', label: 'Rejected' },
  posted: { color: 'bg-purple-400', label: 'Posted' },
};

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const WallPostTaskCard = memo(function WallPostTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
  onDelete,
}: BoardTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();

  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const platform = meta.platform as string | undefined;
  const scheduledDate =
    task.dueDate || (meta.scheduledDate as string | undefined);
  const hashtags = Array.isArray(meta.hashtags)
    ? (meta.hashtags as string[])
    : [];
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';

  // Calculate photo status counts from captionItems
  const captionItems = Array.isArray(meta.captionItems)
    ? (meta.captionItems as Array<{
        captionStatus?: string | null;
        captionText?: string | null;
        isPosted?: boolean;
      }>)
    : [];

  const statusCounts = captionItems.reduce(
    (counts, item) => {
      const hasCaption = !!item.captionText;

      if (item.isPosted) {
        counts.posted++;
      } else if (item.captionStatus === 'approved') {
        counts.approved++;
      } else if (item.captionStatus === 'submitted') {
        counts.submitted++;
      } else if (item.captionStatus === 'rejected') {
        counts.rejected++;
      } else if (!hasCaption) {
        counts.awaitingCaption++;
      } else if (
        !item.captionStatus ||
        ['pending', 'in_progress', 'not_required'].includes(item.captionStatus)
      ) {
        counts.pending++;
      }
      return counts;
    },
    { pending: 0, submitted: 0, approved: 0, rejected: 0, posted: 0, awaitingCaption: 0 },
  );

  const assigneeName = (() => {
    if (!task.assignee) return null;
    const m = orgMembers.find((mb) => mb.clerkId === task.assignee || mb.id === task.assignee);
    if (!m) return task.assignee;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  })();
  const assigneeInitial = assigneeName?.charAt(0)?.toUpperCase() ?? null;

  useEffect(() => { setDraft(task.title); }, [task.title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) onTitleUpdate?.(task, trimmed);
    else setDraft(task.title);
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => {
        const card = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => { if (!editing) onClick?.(task); }}
            className={[
              'group/card relative rounded-xl cursor-pointer select-none',
              'bg-white/[0.03] dark:bg-[#1a2237]/80 backdrop-blur-sm border border-[#2a3450]/60',
              snapshot.isDragging
                ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/50 ring-1 ring-brand-light-pink/20 scale-[1.02]'
                : 'hover:bg-white/[0.06] dark:hover:bg-[#1a2237] hover:border-[#2a3450] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5',
              'transition-all duration-200',
            ].join(' ')}
          >
            <div className="px-3.5 pt-3 pb-2.5">
              {/* Row 1: Task key + platform badge */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide bg-purple-500/15 border-purple-500/25 text-purple-400">
                  <span className="font-mono">{task.taskKey}</span>
                  <span>WALL</span>
                </span>
                {platform && (
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] capitalize">
                    {platform}
                  </span>
                )}
                <span className="flex-1" />
                {scheduledDate && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3 w-3" />
                    {formatDate(scheduledDate)}
                  </span>
                )}
              </div>

              {/* Row 2: Title */}
              {editing ? (
                <div
                  className="flex items-center gap-1 mb-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle();
                      if (e.key === 'Escape') { setDraft(task.title); setEditing(false); }
                    }}
                    className="flex-1 min-w-0 rounded-lg bg-white/5 border border-brand-mid-pink/30 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white focus-visible:outline-none focus-visible:border-brand-light-pink/60"
                  />
                  <button type="button" onClick={saveTitle} className="p-0.5 text-brand-light-pink shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => { setDraft(task.title); setEditing(false); }} className="p-0.5 text-gray-500 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-[13px] font-bold leading-snug text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {task.title}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                    className="inline-block ml-1 opacity-0 group-hover/card:opacity-100 transition-opacity rounded p-0.5 align-middle hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  </button>
                </p>
              )}

              {/* Row 3: Caption status indicators */}
              {captionItems.length > 0 && (
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  {(Object.entries(statusCounts) as [keyof typeof statusCounts, number][])
                    .filter(([, count]) => count > 0)
                    .map(([key, count]) => {
                      const cfg = STATUS_DOT[key];
                      if (!cfg) return null;
                      return (
                        <span key={key} className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                          <span className={`h-2 w-2 rounded-full ${cfg.color}`} />
                          {count} {cfg.label}
                        </span>
                      );
                    })}
                </div>
              )}

              {/* Hashtags */}
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {hashtags.slice(0, 3).map((tag, i) => (
                    <span
                      key={i}
                      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-brand-blue/10 text-brand-blue dark:text-brand-blue/90 border border-brand-blue/20"
                    >
                      #{String(tag)}
                    </span>
                  ))}
                  {hashtags.length > 3 && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-500">
                      +{hashtags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Footer: timestamp + assignee */}
              <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/[0.06]">
                {createdAt && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-500 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(createdAt)}
                  </span>
                )}

                <span className="flex-1" />

                {assigneeInitial ? (
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-light-pink/15 text-brand-light-pink text-[11px] font-bold ring-1 ring-brand-light-pink/20 group-hover/card:ring-brand-light-pink/40 transition-all"
                    title={assigneeName ?? undefined}
                  >
                    {assigneeInitial}
                  </span>
                ) : (
                  <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-600" />
                )}
              </div>
            </div>
          </div>
        );

        if (snapshot.isDragging) return createPortal(card, document.body);
        return card;
      }}
    </Draggable>
  );
});
