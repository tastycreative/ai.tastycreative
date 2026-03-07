'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import {
  Clock,
  User,
  Pencil,
  Check,
  X,
  BadgeCheck,
  Loader2,
} from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
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
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  OTP: { bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400' },
  PTR: { bg: 'bg-brand-light-pink/15 border-brand-light-pink/25', text: 'text-brand-light-pink' },
  CUSTOM: { bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' },
};

const STYLE_LABEL: Record<string, string> = {
  GAME: 'Game',
  PPV: 'PPV',
  POLL: 'Poll',
  BUNDLE: 'Bundle',
  NORMAL: '',
};

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
}: OtpPtrTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [markingFinal, setMarkingFinal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();

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

  const requestType = (meta.requestType as string) ?? '';
  const contentStyle = (meta.contentStyle as string) ?? 'NORMAL';
  const styleLabel = STYLE_LABEL[contentStyle] ?? '';
  const price = meta.price as number | undefined;
  const isPaid = meta.isPaid as boolean | undefined;
  const model = (meta.model as string) ?? '';
  const buyer = (meta.buyer as string) ?? '';
  const platforms = Array.isArray(meta.platforms) ? (meta.platforms as string[]) : [];
  const deadline = (meta.deadline as string) ?? '';
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';
  const captionStatus = (meta.otpPtrCaptionStatus as OtpPtrCaptionStatus) ?? null;
  const dl = deadline ? deadlineLabel(deadline) : null;

  const assigneeName = (() => {
    if (!task.assignee) return null;
    const m = orgMembers.find((mb) => mb.clerkId === task.assignee || mb.id === task.assignee);
    if (!m) return task.assignee;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  })();

  const assigneeInitial = assigneeName?.charAt(0)?.toUpperCase() ?? null;
  const typeBadge = TYPE_BADGE[requestType] ?? { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' };
  const priorityBorder = PRIORITY_BORDER[task.priority ?? ''] ?? 'border-l-transparent';

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
              {/* Row 1: ticket badge + style + caption status */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${typeBadge.bg} ${typeBadge.text}`}>
                  <span className="font-mono">{task.taskKey}</span>
                  {requestType && <span>{requestType}</span>}
                </span>
                {styleLabel && (
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5">
                    {styleLabel}
                  </span>
                )}

                <span className="flex-1" />

                {captionStatus && OTP_PTR_STATUS_CONFIG[captionStatus] && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-white/5 border border-white/[0.06] ${OTP_PTR_STATUS_CONFIG[captionStatus].color}`}
                    title={OTP_PTR_STATUS_CONFIG[captionStatus].label}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${OTP_PTR_STATUS_CONFIG[captionStatus].dotColor}`} />
                    {OTP_PTR_STATUS_CONFIG[captionStatus].label}
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

              {/* Row 3: Price, paid status, buyer, model, deadline */}
              <div className="flex items-center gap-2 flex-wrap text-xs mb-2.5">
                {price != null && price > 0 && (
                  <span className="font-bold text-brand-light-pink">
                    ${price}
                  </span>
                )}
                {isPaid != null && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                    isPaid
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {isPaid ? 'paid' : 'unpaid'}
                  </span>
                )}
                {buyer && (
                  <span className="text-gray-500 dark:text-gray-500 truncate max-w-[90px]">@{buyer}</span>
                )}
                {model && (
                  <span className="text-gray-500 dark:text-gray-500 truncate max-w-[90px]">{model}</span>
                )}
                {platforms.length > 0 && platforms.map((p) => (
                  <span key={p} className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06]">
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
              <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/[0.06]">
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
