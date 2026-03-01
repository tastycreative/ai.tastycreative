'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Pencil, Check, X } from 'lucide-react';

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
}

const PRIORITY_STYLES: Record<string, string> = {
  High: 'bg-red-500/10 text-red-500 dark:text-red-400',
  Medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export function BoardTaskCard({ task, index, onClick, onTitleUpdate }: BoardTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleUpdate?.(task, trimmed);
    } else {
      setDraft(task.title);
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => {
        const card = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => {
              if (!editing) onClick?.(task);
            }}
            className={[
              'group/card relative rounded-xl bg-white dark:bg-gray-900/90 border px-3.5 py-3 cursor-pointer select-none',
              snapshot.isDragging
                ? 'shadow-xl border-brand-light-pink/70 ring-2 ring-brand-light-pink/30'
                : 'shadow-sm border-gray-200 dark:border-brand-mid-pink/20 hover:shadow-md hover:border-brand-light-pink/50',
            ].join(' ')}
          >
            {/* Task key */}
            <span className="text-[10px] font-semibold tracking-wide text-brand-blue/80 dark:text-brand-blue/70 mb-1 block">
              {task.taskKey}
            </span>

            {task.priority && (
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${PRIORITY_STYLES[task.priority] ?? ''}`}
              >
                {task.priority}
              </span>
            )}

            {/* Title row with inline edit */}
            {editing ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') {
                      setDraft(task.title);
                      setEditing(false);
                    }
                  }}
                  className="flex-1 min-w-0 rounded-lg border border-brand-light-pink/50 bg-white dark:bg-gray-900 px-2 py-0.5 text-[13px] font-medium text-gray-800 dark:text-brand-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60"
                />
                <button type="button" onClick={saveTitle} className="p-0.5 text-brand-light-pink shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(task.title);
                    setEditing(false);
                  }}
                  className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-[13px] font-medium leading-snug text-gray-800 dark:text-brand-off-white wrap-break-word">
                {task.title}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="inline-block ml-1 opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-0.5 align-middle"
                >
                  <Pencil className="h-3 w-3 text-gray-400 hover:text-brand-light-pink" />
                </button>
              </p>
            )}

            {(task.tags?.length || task.assignee) && (
              <div className="mt-2.5 flex items-center justify-between gap-2">
                {task.tags && task.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-brand-light-pink/10 text-brand-light-pink px-2 py-0.5 text-[10px] font-medium truncate"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {task.assignee && (
                  <span
                    className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue text-[10px] font-bold uppercase"
                    title={task.assignee}
                  >
                    {task.assignee.charAt(0)}
                  </span>
                )}
              </div>
            )}
          </div>
        );

        if (snapshot.isDragging) {
          return createPortal(card, document.body);
        }

        return card;
      }}
    </Draggable>
  );
}
