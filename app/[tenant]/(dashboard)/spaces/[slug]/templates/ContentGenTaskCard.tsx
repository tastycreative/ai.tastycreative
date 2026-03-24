'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import {
  Clock,
  Pencil,
  Check,
  X,
  Trash2,
  Clapperboard,
  FolderOpen,
  Hash,
} from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import type { BoardTask } from '../../board';
import type { VaultAssetRef, ContentGenTaskType } from '@/lib/spaces/template-metadata';

interface ContentGenTaskCardProps {
  task: BoardTask;
  index: number;
  onClick?: (task: BoardTask) => void;
  onTitleUpdate?: (task: BoardTask, newTitle: string) => void;
  columnTitle?: string;
  onMarkFinal?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  IG_SFW_REELS: { bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400' },
  NSFW_PPV: { bg: 'bg-rose-500/15 border-rose-500/25', text: 'text-rose-400' },
  WALL_POSTS: { bg: 'bg-violet-500/15 border-violet-500/25', text: 'text-violet-400' },
  STORIES: { bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' },
  PROMO: { bg: 'bg-emerald-500/15 border-emerald-500/25', text: 'text-emerald-400' },
  CUSTOM: { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' },
};

const TYPE_LABELS: Record<string, string> = {
  IG_SFW_REELS: 'IG Reels',
  NSFW_PPV: 'NSFW PPV',
  WALL_POSTS: 'Wall Posts',
  STORIES: 'Stories',
  PROMO: 'Promo',
  CUSTOM: 'Custom',
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

export const ContentGenTaskCard = memo(function ContentGenTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
  columnTitle,
  onDelete,
}: ContentGenTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();

  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const taskType = (meta.taskType as ContentGenTaskType) ?? 'CUSTOM';
  const quantity = (meta.quantity as number) ?? 1;
  const clientName = (meta.clientName as string) ?? '';
  const assignedTo = Array.isArray(meta.assignedTo) ? (meta.assignedTo as string[]) : [];
  const vaultAssets = Array.isArray(meta.vaultAssets) ? (meta.vaultAssets as VaultAssetRef[]) : [];
  const deadline = (meta.deadline as string) ?? '';
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';

  useEffect(() => { setDraft(task.title); }, [task.title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) onTitleUpdate?.(task, trimmed);
    else setDraft(task.title);
  };

  const typeBadge = TYPE_BADGE[taskType] ?? TYPE_BADGE.CUSTOM;
  const typeLabel = TYPE_LABELS[taskType] ?? taskType;
  const dl = deadline ? deadlineLabel(deadline) : null;

  const assigneeNames = assignedTo.map((uid) => {
    const m = orgMembers.find((mb) => mb.clerkId === uid || mb.id === uid);
    if (!m) return uid;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  });

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
              'bg-white/90 dark:bg-gray-900/70 backdrop-blur-lg border border-gray-200/80 dark:border-white/[0.08] shadow-sm dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.25)] ring-1 ring-transparent dark:ring-white/[0.05]',
              snapshot.isDragging
                ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/40 ring-brand-light-pink/20 scale-[1.02] dark:bg-gray-900/80'
                : 'hover:shadow-xl dark:hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-pink-200 dark:hover:border-white/[0.12] dark:hover:bg-gray-900/80 hover:-translate-y-0.5',
              'transition-all duration-200',
            ].join(' ')}
          >
            <div className="px-3.5 pt-3 pb-2.5">
              {/* Row 1: ticket key + task type badge */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${typeBadge.bg} ${typeBadge.text}`}>
                  <Clapperboard className="h-2.5 w-2.5" />
                  <span className="font-mono">{task.taskKey}</span>
                  <span>{typeLabel}</span>
                </span>

                <span className="flex-1" />

                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${task.title}"?`)) {
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
                <div className="flex items-center gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
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

              {/* Row 3: client + quantity + assets + deadline */}
              <div className="flex items-center gap-2 flex-wrap text-xs mb-2.5">
                {clientName && (
                  <span className="text-gray-500 dark:text-gray-500 truncate max-w-[100px]">{clientName}</span>
                )}
                {quantity > 1 && (
                  <span className="flex items-center gap-0.5 text-brand-blue font-semibold">
                    <Hash className="h-3 w-3" />
                    {quantity}
                  </span>
                )}
                {vaultAssets.length > 0 && (
                  <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
                    <FolderOpen className="h-3 w-3" />
                    {vaultAssets.length}
                  </span>
                )}
                {dl && (
                  <span className={`font-semibold ${dl.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                    {dl.text}
                  </span>
                )}
              </div>

              {/* Footer: assignees + timestamp */}
              <div className="flex items-center gap-2.5 pt-2.5 border-t border-gray-200/50 dark:border-white/[0.08]">
                {/* Assignee avatars (max 3) */}
                {assigneeNames.length > 0 && (
                  <div className="flex -space-x-1.5">
                    {assigneeNames.slice(0, 3).map((name, i) => (
                      <span
                        key={i}
                        className="h-5 w-5 rounded-full bg-brand-light-pink/15 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-[9px] font-bold text-brand-light-pink"
                        title={name}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {assigneeNames.length > 3 && (
                      <span className="h-5 w-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-400">
                        +{assigneeNames.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <span className="flex-1" />
                {createdAt && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-600">
                    <Clock className="h-3 w-3" />
                    {timeAgo(createdAt)}
                  </span>
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
