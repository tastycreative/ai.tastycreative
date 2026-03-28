'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { Draggable } from '@hello-pangea/dnd';
import {
  Pencil,
  Check,
  X,
  Clock,
  User,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  BadgeCheck,
  Loader2,
} from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import type { BoardTaskCardProps, BoardTask } from '../../board/BoardTaskCard';
import {
  SEXTING_SET_STATUS_CONFIG,
  type SextingSetStatus,
} from '@/lib/sexting-set-status';

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

export const SextingSetsTaskCard = memo(function SextingSetsTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
  onDelete,
  columnTitle,
  onMarkFinal,
}: BoardTaskCardProps) {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [markingFinal, setMarkingFinal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();

  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';
  const category = (meta.category as string) ?? '';
  const setSize = typeof meta.setSize === 'number' ? meta.setSize : 0;
  const model = (meta.model as string) ?? '';
  const quality = (meta.quality as string) ?? '';
  const sextingSetStatus = (meta.sextingSetStatus as SextingSetStatus) || '';
  const captionTicketId = (meta.captionTicketId as string) ?? '';
  const images = Array.isArray(meta.images) ? (meta.images as Array<{ url: string }>) : [];

  // Caption item status counts
  const captionItems = Array.isArray(meta.captionItems)
    ? (meta.captionItems as Array<{ captionStatus?: string | null; isPosted?: boolean }>)
    : [];

  const statusCounts = captionItems.reduce(
    (counts, item) => {
      if (item.isPosted) counts.posted++;
      else if (item.captionStatus === 'approved') counts.approved++;
      else if (item.captionStatus === 'submitted') counts.submitted++;
      else if (item.captionStatus === 'rejected') counts.rejected++;
      else counts.pending++;
      return counts;
    },
    { pending: 0, submitted: 0, approved: 0, rejected: 0, posted: 0 },
  );

  const statusConfig = sextingSetStatus
    ? SEXTING_SET_STATUS_CONFIG[sextingSetStatus]
    : null;

  const assigneeName = (() => {
    if (!task.assignee) return null;
    const m = orgMembers.find(
      (mb) => mb.clerkId === task.assignee || mb.id === task.assignee,
    );
    if (!m) return task.assignee;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  })();
  const assigneeInitial = assigneeName?.charAt(0)?.toUpperCase() ?? null;

  const priorityBorder =
    PRIORITY_BORDER[task.priority ?? ''] ?? 'border-l-transparent';

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
            onClick={() => {
              if (!editing) onClick?.(task);
            }}
            className={[
              'group/card relative rounded-xl cursor-pointer select-none',
              'bg-white/[0.03] dark:bg-[#1a2237]/80 backdrop-blur-sm border border-[#2a3450]/60',
              task.priority ? `border-l-[3px] ${priorityBorder}` : '',
              snapshot.isDragging
                ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/50 ring-1 ring-brand-light-pink/20 scale-[1.02]'
                : 'hover:bg-white/[0.06] dark:hover:bg-[#1a2237] hover:border-[#2a3450] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5',
              'transition-all duration-200',
            ].join(' ')}
          >
            {/* Image preview strip */}
            {images.length > 0 && (
              <div className="flex gap-0.5 rounded-t-xl overflow-hidden h-16">
                {images.slice(0, 4).map((img, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-800 relative overflow-hidden"
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    {i === 3 && images.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          +{images.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="px-3.5 pt-3 pb-2.5">
              {/* Row 1: Task key + badges */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide bg-brand-light-pink/15 border-brand-light-pink/25 text-brand-light-pink">
                  <span className="font-mono">{task.taskKey}</span>
                </span>

                {setSize > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-white/5 border border-white/[0.06] rounded px-1.5 py-0.5">
                    <ImageIcon className="h-3 w-3" />
                    {setSize}
                  </span>
                )}

                {quality && (
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06]">
                    {quality}
                  </span>
                )}

                <span className="flex-1" />

                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Are you sure you want to delete "${task.title}"?`,
                        )
                      ) {
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
                      if (e.key === 'Escape') {
                        setDraft(task.title);
                        setEditing(false);
                      }
                    }}
                    className="flex-1 min-w-0 rounded-lg bg-white/5 border border-brand-mid-pink/30 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white focus-visible:outline-none focus-visible:border-brand-light-pink/60"
                  />
                  <button
                    type="button"
                    onClick={saveTitle}
                    className="p-0.5 text-brand-light-pink shrink-0"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(task.title);
                      setEditing(false);
                    }}
                    className="p-0.5 text-gray-500 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-[13px] font-bold leading-snug text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {task.title}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(true);
                    }}
                    className="inline-block ml-1 opacity-0 group-hover/card:opacity-100 transition-opacity rounded p-0.5 align-middle hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  </button>
                </p>
              )}

              {/* Row 3: Model / Category badges */}
              {(model || category) && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {model && (
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] capitalize">
                      {model}
                    </span>
                  )}
                  {category && category !== model && (
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06]">
                      {category}
                    </span>
                  )}
                </div>
              )}

              {/* Row 4: Status badge */}
              {statusConfig && (
                <div className="mb-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig.bgClass} ${statusConfig.textClass}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {statusConfig.label}
                  </span>
                </div>
              )}

              {/* Row 5: Caption item status indicator dots */}
              {captionItems.length > 0 && (
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  {statusCounts.approved > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {statusCounts.approved} Approved
                    </span>
                  )}
                  {statusCounts.submitted > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-brand-blue" />
                      {statusCounts.submitted} Submitted
                    </span>
                  )}
                  {statusCounts.rejected > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      {statusCounts.rejected} Rejected
                    </span>
                  )}
                  {statusCounts.pending > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      {statusCounts.pending} Pending
                    </span>
                  )}
                  {statusCounts.posted > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-purple-400" />
                      {statusCounts.posted} Posted
                    </span>
                  )}
                </div>
              )}

              {/* Mark as Final */}
              {columnTitle?.toLowerCase().includes('review') && onMarkFinal && (
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
                  {markingFinal ? 'Finalizing...' : 'Mark as Final'}
                </button>
              )}

              {/* Footer: priority + timestamp + caption link + assignee */}
              <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/[0.06]">
                {task.priority && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] ?? ''}`}
                    />
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
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-blue hover:text-brand-blue/80 px-1.5 py-0.5 rounded-md border border-brand-blue/20 bg-brand-blue/10 hover:bg-brand-blue/15 transition-colors cursor-pointer"
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

export default SextingSetsTaskCard;
