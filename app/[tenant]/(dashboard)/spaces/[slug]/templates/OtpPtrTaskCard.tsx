'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import {
  Clock,
  User,
  Pencil,
  Check,
  X,
  Gamepad2,
  Crown,
  BarChart3,
  Package,
  Layers,
  DollarSign,
  CheckCircle2,
  CircleX,
} from 'lucide-react';
import type { BoardTask } from '../../board';

interface OtpPtrTaskCardProps {
  task: BoardTask;
  index: number;
  onClick?: (task: BoardTask) => void;
  onTitleUpdate?: (task: BoardTask, newTitle: string) => void;
}

/* ── Content style badge config ─────────────────────────────── */

const CONTENT_STYLE_CONFIG: Record<
  string,
  { icon: typeof Gamepad2; label: string; bg: string; text: string; border: string }
> = {
  GAME: {
    icon: Gamepad2,
    label: 'Game',
    bg: 'bg-amber-500/12',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
  },
  PPV: {
    icon: Crown,
    label: 'PPV',
    bg: 'bg-violet-500/12',
    text: 'text-violet-400',
    border: 'border-violet-500/25',
  },
  POLL: {
    icon: BarChart3,
    label: 'Poll',
    bg: 'bg-sky-500/12',
    text: 'text-sky-400',
    border: 'border-sky-500/25',
  },
  BUNDLE: {
    icon: Package,
    label: 'Bundle',
    bg: 'bg-emerald-500/12',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
  },
  NORMAL: {
    icon: Layers,
    label: 'Standard',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
  },
};

/* ── Priority pill styles ───────────────────────────────────── */

const PRIORITY_PILL: Record<string, string> = {
  High: 'border-red-500/40 text-red-400 bg-red-500/8',
  Medium: 'border-amber-500/40 text-amber-400 bg-amber-500/8',
  Low: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/8',
};

/* ── Relative time helper ───────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  return `${Math.floor(days / 30)}mo ago`;
}

/* ── Card component ─────────────────────────────────────────── */

export function OtpPtrTaskCard({ task, index, onClick, onTitleUpdate }: OtpPtrTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = (task.metadata ?? {}) as Record<string, unknown>;

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

  // Extract metadata
  const contentStyle = (meta.contentStyle as string) ?? 'NORMAL';
  const styleConfig = CONTENT_STYLE_CONFIG[contentStyle] ?? CONTENT_STYLE_CONFIG.NORMAL;
  const StyleIcon = styleConfig.icon;
  const price = meta.price as number | undefined;
  const isPaid = meta.isPaid as boolean | undefined;
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';
  const model = (meta.model as string) || task.assignee;

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
              'group/card relative rounded-xl overflow-hidden cursor-pointer select-none',
              'bg-white dark:bg-gray-900/90 border',
              snapshot.isDragging
                ? 'shadow-xl border-brand-light-pink/70 ring-2 ring-brand-light-pink/30'
                : 'shadow-sm border-gray-200 dark:border-brand-mid-pink/15 hover:shadow-lg hover:border-brand-light-pink/40',
              'transition-all duration-200',
            ].join(' ')}
          >
            {/* Gradient left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{
                background: 'linear-gradient(180deg, #F774B9, #EC67A1, #5DC3F8)',
              }}
            />

            <div className="pl-3.5 pr-3 py-2.5">
              {/* Row 1: Task key + Title */}
              <div className="flex items-start gap-2 mb-1.5">
                <span className="shrink-0 text-[10px] font-bold tracking-wide text-brand-blue/80 dark:text-brand-blue/70 mt-0.5">
                  {task.taskKey}
                </span>

                {editing ? (
                  <div
                    className="flex items-center gap-1 flex-1 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                      className="flex-1 min-w-0 rounded border border-brand-light-pink/50 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[12px] font-medium text-gray-800 dark:text-brand-off-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-light-pink/60"
                    />
                    <button
                      type="button"
                      onClick={saveTitle}
                      className="p-0.5 text-brand-light-pink shrink-0"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(task.title);
                        setEditing(false);
                      }}
                      className="p-0.5 text-gray-400 shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <p className="flex-1 min-w-0 text-[12px] font-semibold leading-snug text-gray-800 dark:text-brand-off-white truncate">
                    {task.title}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(true);
                      }}
                      className="inline-block ml-1 opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-0.5 align-middle"
                    >
                      <Pencil className="h-2.5 w-2.5 text-gray-400 hover:text-brand-light-pink" />
                    </button>
                  </p>
                )}
              </div>

              {/* Row 2: Badges — content style + price + paid status */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${styleConfig.bg} ${styleConfig.text} ${styleConfig.border}`}
                >
                  <StyleIcon className="h-3 w-3" />
                  {styleConfig.label}
                </span>

                {price != null && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium">
                    <DollarSign className="h-2.5 w-2.5" />
                    {price}
                  </span>
                )}

                {isPaid != null && (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${
                      isPaid
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {isPaid ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <CircleX className="h-2.5 w-2.5" />
                    )}
                    {isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                )}
              </div>

              {/* Row 3: Description preview */}
              {task.description && (
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                  {task.description}
                </p>
              )}

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-gray-800/80 mb-2" />

              {/* Row 4: Priority + Time + Assignee */}
              <div className="flex items-center gap-2 text-[10px]">
                {task.priority && (
                  <span
                    className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-medium ${PRIORITY_PILL[task.priority] ?? ''}`}
                  >
                    {task.priority}
                  </span>
                )}

                {createdAt && (
                  <span className="inline-flex items-center gap-0.5 text-gray-400 dark:text-gray-500">
                    <Clock className="h-3 w-3" />
                    {timeAgo(createdAt)}
                  </span>
                )}

                <span className="flex-1" />

                <span className="inline-flex items-center gap-0.5 text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                  <User className="h-3 w-3 shrink-0" />
                  {model || 'Unassigned'}
                </span>
              </div>
            </div>
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
