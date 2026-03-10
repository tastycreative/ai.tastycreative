'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Pencil, Check, X, Clock, User } from 'lucide-react';

export interface BoardTask {
  id: string;
  taskKey: string;
  title: string;
  description?: string;
  assignee?: string;
  reporter?: string;
  priority?: 'Low' | 'Medium' | 'High';
  tags?: string[];
  startDate?: string;
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

export interface BoardTaskCardProps {
  task: BoardTask;
  index: number;
  onClick?: (task: BoardTask) => void;
  onTitleUpdate?: (task: BoardTask, newTitle: string) => void;
  columnTitle?: string;
  onMarkFinal?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  High: 'border-l-red-400',
  Medium: 'border-l-amber-400',
  Low: 'border-l-emerald-400',
};

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-400',
  Medium: 'bg-amber-400',
  Low: 'bg-emerald-400',
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

export const BoardTaskCard = memo(function BoardTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
}: BoardTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';
  const priorityBorder = PRIORITY_BORDER[task.priority ?? ''] ?? 'border-l-transparent';

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
              'border-l-[3px]',
              priorityBorder,
              'bg-white/[0.03] dark:bg-[#1a2237]/80 backdrop-blur-sm border border-[#2a3450]/60',
              snapshot.isDragging
                ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/50 ring-1 ring-brand-light-pink/20 scale-[1.02]'
                : 'hover:bg-white/[0.06] dark:hover:bg-[#1a2237] hover:border-[#2a3450] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5',
              'transition-all duration-200',
            ].join(' ')}
          >
            <div className="px-3.5 pt-3 pb-2.5">
              {/* Row 1: Task key + priority badge */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide bg-gray-500/15 border-gray-500/25 text-gray-400 font-mono">
                  {task.taskKey}
                </span>

                <span className="flex-1" />

                {task.priority && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] ?? ''}`} />
                    {task.priority}
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

              {/* Row 3: Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-brand-light-pink/10 text-brand-light-pink px-1.5 py-0.5 text-[10px] font-medium border border-brand-light-pink/15 truncate"
                    >
                      {tag}
                    </span>
                  ))}
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

                {task.assignee ? (
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue text-[11px] font-bold ring-1 ring-brand-blue/20 group-hover/card:ring-brand-blue/40 transition-all"
                    title={task.assignee}
                  >
                    {task.assignee.charAt(0).toUpperCase()}
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
