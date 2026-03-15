'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { Draggable } from '@hello-pangea/dnd';
import {
  Clock,
  User,
  Pencil,
  Check,
  X,
  BadgeCheck,
  Loader2,
  Trash2,
  Pause,
  ExternalLink,
} from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import { usePausedModels } from '@/lib/hooks/usePausedModels.query';
import {
  OTP_PTR_STATUS_CONFIG,
  type OtpPtrCaptionStatus,
} from '@/lib/otp-ptr-caption-status';
import type { BoardTask } from '../../board';

interface OtpPtrTaskCardProps {
  task: BoardTask;
  index: number;
  onClick?: (task: BoardTask) => void;
  onTitleUpdate?: (task: BoardTask, newTitle: string) => void;
  columnTitle?: string;
  onMarkFinal?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  OTP: { bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400' },
  PTR: { bg: 'bg-brand-light-pink/15 border-brand-light-pink/25', text: 'text-brand-light-pink' },
  OTM: { bg: 'bg-violet-500/15 border-violet-500/25', text: 'text-violet-400' },
  PPV: { bg: 'bg-emerald-500/15 border-emerald-500/25', text: 'text-emerald-400' },
  GAME: { bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' },
  LIVE: { bg: 'bg-red-500/15 border-red-500/25', text: 'text-red-400' },
  TIP_ME: { bg: 'bg-cyan-500/15 border-cyan-500/25', text: 'text-cyan-400' },
  VIP: { bg: 'bg-yellow-500/15 border-yellow-500/25', text: 'text-yellow-400' },
  DM_FUNNEL: { bg: 'bg-indigo-500/15 border-indigo-500/25', text: 'text-indigo-400' },
  RENEW_ON: { bg: 'bg-teal-500/15 border-teal-500/25', text: 'text-teal-400' },
  CUSTOM: { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' },
};

const PRIORITY_BORDER: Record<string, string> = {
  Urgent: 'border-l-rose-400',
  High: 'border-l-amber-400',
  Normal: 'border-l-sky-400',
  Low: 'border-l-emerald-400',
};

const PRIORITY_DOT: Record<string, string> = {
  Urgent: 'bg-rose-400',
  High: 'bg-amber-400',
  Normal: 'bg-sky-400',
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

function deadlineLabel(deadline: string): { text: string; urgent: boolean } | null {
  const d = new Date(deadline).getTime();
  if (isNaN(d)) return null;
  const hoursLeft = (d - Date.now()) / 3600000;
  if (hoursLeft < 0) return { text: 'overdue', urgent: true };
  if (hoursLeft < 24) return { text: 'today', urgent: true };
  if (hoursLeft < 72) return { text: 'soon', urgent: false };
  return null;
}

export const OtpPtrTaskCard = memo(function OtpPtrTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
  columnTitle,
  onMarkFinal,
  onDelete,
}: OtpPtrTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [markingFinal, setMarkingFinal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();
  const { pausedModelsMap } = usePausedModels();
  const router = useRouter();
  const params = useParams<{ tenant: string }>();

  const isReadyToDeploy = columnTitle?.toLowerCase().includes('ready to deploy') ?? false;
  const meta = (task.metadata ?? {}) as Record<string, unknown>;

  useEffect(() => { setDraft(task.title); }, [task.title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) onTitleUpdate?.(task, trimmed);
    else setDraft(task.title);
  };

  // Backward compat: read postOrigin, fall back to old requestType
  const postOrigin = (meta.postOrigin as string) ?? (meta.requestType as string) ?? '';
  const price = meta.price as number | undefined;
  const model = (meta.model as string) ?? '';
  const platforms = Array.isArray(meta.platforms) ? (meta.platforms as string[]) : [];
  const deadline = (meta.deadline as string) ?? '';
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';
  const captionStatus = (meta.otpPtrCaptionStatus as OtpPtrCaptionStatus) ?? null;
  const captionTicketId = (meta.captionTicketId as string) ?? null;
  const dl = deadline ? deadlineLabel(deadline) : null;

  const assigneeName = (() => {
    if (!task.assignee) return null;
    const m = orgMembers.find((mb) => mb.clerkId === task.assignee || mb.id === task.assignee);
    if (!m) return task.assignee;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  })();

  const assigneeInitial = assigneeName?.charAt(0)?.toUpperCase() ?? null;
  const typeBadge = TYPE_BADGE[postOrigin] ?? { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' };
  const priorityBorder = PRIORITY_BORDER[task.priority ?? ''] ?? 'border-l-transparent';

  // Check if model is paused and if the task's content style matches
  const modelPausedStyles = model ? pausedModelsMap.get(model) : undefined;
  const contentStyle = (meta.contentStyle as string) ?? '';
  const isContentStylePaused = modelPausedStyles && modelPausedStyles.length > 0 && contentStyle
    ? modelPausedStyles.includes(contentStyle)
    : false;
  const showPausedBadge = isContentStylePaused;

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
              'group/card relative rounded-xl cursor-pointer overflow-hidden select-none',
              'border-l-[3px]',
              priorityBorder,
              'bg-white/90 dark:bg-gray-900/70 backdrop-blur-lg border border-gray-200/80 dark:border-white/[0.08] shadow-sm dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.25)] ring-1 ring-transparent dark:ring-white/[0.05]',
              snapshot.isDragging
                ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/40 ring-brand-light-pink/20 scale-[1.02] dark:bg-gray-900/80'
                : 'hover:shadow-xl dark:hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-pink-200 dark:hover:border-white/[0.12] dark:hover:bg-gray-900/80 hover:-translate-y-0.5',
              'transition-all duration-200',
            ].join(' ')}
          >
            <div className="px-3.5 pt-3 pb-2.5">
              {/* Paused badge */}
              {showPausedBadge && (
                <div className={`-mx-3.5 -mt-3 mb-2 px-3 py-1.5 text-[10px] font-bold tracking-wide flex items-center gap-1.5 ${
                  isContentStylePaused
                    ? 'bg-amber-500/15 text-amber-400 border-b border-amber-500/20'
                    : 'bg-amber-500/8 text-amber-500/70 border-b border-amber-500/10'
                }`}>
                  <Pause className="h-3 w-3" />
                  PAUSED{isContentStylePaused && contentStyle ? ` — ${contentStyle}` : ''}
                </div>
              )}
              {/* Row 1: ticket badge + post origin + caption status */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${typeBadge.bg} ${typeBadge.text}`}>
                  <span className="font-mono">{task.taskKey}</span>
                  {postOrigin && <span>{postOrigin.replace(/_/g, ' ')}</span>}
                </span>

                <span className="flex-1" />

                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
                        onDelete(task.id);
                      }
                    }}
                    className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                    title="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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

              {/* Row 3: Price, model, platforms, deadline */}
              <div className="flex items-center gap-2 flex-wrap text-xs mb-2.5">
                {price != null && price > 0 && (
                  <span className="font-bold text-brand-light-pink">
                    ${price}
                  </span>
                )}
                {model && (
                  <span className="text-gray-500 dark:text-gray-500 truncate max-w-[90px]">{model}</span>
                )}
                {platforms.length > 0 && platforms.map((p) => (
                  <span key={p} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    p === 'onlyfans'
                      ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/25'
                      : p === 'fansly'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                      : 'bg-gray-500/10 text-gray-400 border-gray-500/25'
                  }`}>
                    {p === 'onlyfans' ? 'OF' : p === 'fansly' ? 'Fansly' : p}
                  </span>
                ))}
                {dl && (
                  <span className={`font-semibold ${dl.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                    {dl.text}
                  </span>
                )}
              </div>

              {/* Mark as Final */}
              {isReadyToDeploy && onMarkFinal && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMarkingFinal(true);
                    onMarkFinal(task.id);
                  }}
                  disabled={markingFinal}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] text-emerald-400 px-2.5 py-1.5 text-xs font-semibold transition-colors mb-2 disabled:opacity-40"
                >
                  {markingFinal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                  {markingFinal ? 'Posting...' : 'Mark as Final'}
                </button>
              )}

              {/* Footer: priority + timestamp + assignee */}
              <div className="flex items-center gap-2.5 pt-2.5 border-t border-gray-200/50 dark:border-white/[0.08]">
                {task.priority && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] ?? ''}`} />
                    {task.priority}
                  </span>
                )}
                {createdAt && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-500 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(createdAt)}
                  </span>
                )}

                <span className="flex-1" />

                {captionTicketId && (
                  <button
                    type="button"
                    title="Open in Caption Workspace"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/${params.tenant}/workspace/caption-workspace?ticket=${captionTicketId}`);
                    }}
                    className="opacity-0 group-hover/card:opacity-100 transition-opacity inline-flex items-center gap-1 text-[10px] font-semibold text-brand-blue hover:text-brand-blue/80 px-1.5 py-0.5 rounded-md border border-brand-blue/20 hover:bg-brand-blue/10"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Caption
                  </button>
                )}

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
