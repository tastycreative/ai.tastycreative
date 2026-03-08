'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Pencil, Check, X, User } from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import type { BoardTask } from '../../board';

interface ModelOnboardingTaskCardProps {
  task: BoardTask;
  index: number;
  onClick?: (task: BoardTask) => void;
  onTitleUpdate?: (task: BoardTask, newTitle: string) => void;
}

export const ModelOnboardingTaskCard = memo(function ModelOnboardingTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
}: ModelOnboardingTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();

  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const modelName = (meta.modelName as string) ?? '';
  const platform = (meta.platform as string) ?? '';
  const checklist = Array.isArray(meta.checklist) ? (meta.checklist as { completed: boolean }[]) : [];
  const total = checklist.length;
  const done = checklist.filter((c) => c.completed).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => { setDraft(task.title); }, [task.title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) onTitleUpdate?.(task, trimmed);
    else setDraft(task.title);
  };

  const assigneeName = (() => {
    if (!task.assignee) return null;
    const m = orgMembers.find((mb) => mb.clerkId === task.assignee || mb.id === task.assignee);
    if (!m) return task.assignee;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  })();

  const assigneeInitial = assigneeName?.charAt(0)?.toUpperCase() ?? null;

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
              'group/card relative rounded-lg cursor-pointer select-none',
              'bg-white dark:bg-[#111016] border',
              snapshot.isDragging
                ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/50 ring-1 ring-brand-light-pink/20'
                : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12]',
              'transition-colors duration-150',
            ].join(' ')}
          >
            <div className="px-3.5 pt-3 pb-2.5">
              {/* Row 1: key + platform tag */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
                  {task.taskKey}
                </span>
                {platform && (
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 capitalize bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
                    {platform}
                  </span>
                )}
                <span className="flex-1" />
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
                    className="flex-1 min-w-0 rounded bg-transparent border border-brand-mid-pink/30 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white focus-visible:outline-none focus-visible:border-brand-light-pink/60"
                  />
                  <button type="button" onClick={saveTitle} className="p-0.5 text-brand-light-pink shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => { setDraft(task.title); setEditing(false); }} className="p-0.5 text-gray-500 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-white mb-2 line-clamp-2">
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

              {/* Row 3: Model name */}
              {modelName && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-400 mb-2">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{modelName}</span>
                </div>
              )}

              {/* Row 4: Mini progress bar */}
              {total > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold ${progress === 100 ? 'text-emerald-400' : 'text-brand-light-pink'}`}>
                      {done}/{total}
                    </span>
                    <span className={`text-[10px] font-bold ${progress === 100 ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {progress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-light-pink'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer: assignee */}
              <div className="flex items-center gap-2.5 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                <span className="flex-1" />
                {assigneeInitial ? (
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-mid-pink/15 text-brand-mid-pink text-[11px] font-bold"
                    title={assigneeName ?? undefined}
                  >
                    {assigneeInitial}
                  </span>
                ) : (
                  <User className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
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
