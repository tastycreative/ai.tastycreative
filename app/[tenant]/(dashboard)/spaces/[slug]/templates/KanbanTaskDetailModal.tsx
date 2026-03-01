'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  User,
  UserCircle,
  Flag,
  CalendarDays,
  CalendarClock,
  ListTodo,
  Hash,
  Tag,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import { ActivityFeed, type TaskComment, type TaskHistoryEntry } from '../../board/ActivityFeed';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useBoardItemComments, useAddComment, useBoardItemHistory } from '@/lib/hooks/useBoardItems.query';

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

const PRIORITY_OPTIONS: BoardTask['priority'][] = ['Low', 'Medium', 'High'];
const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-emerald-500',
};


function SidebarLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="h-3.5 w-3.5 text-gray-400" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

/**
 * Kanban task detail — classic Jira-style two-column layout.
 * Left: title, description, story points / labels inline, activity feed.
 * Right: status, assignee, reporter, priority, dates, tags.
 */
export function KanbanTaskDetailModal({ task, columnTitle, isOpen, onClose, onUpdate }: Props) {
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Derive spaceId and boardId from URL slug
  const params = useParams<{ slug: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;

  // Fetch real comments from API - only when modal is open
  const { data: commentsData, isLoading: commentsLoading } = useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(spaceId ?? '', boardId ?? '', task.id);

  // Map API BoardItemComment → ActivityFeed TaskComment
  const comments: TaskComment[] = useMemo(() => {
    if (!commentsData?.comments) return [];
    const currentUserId = user?.id;
    return commentsData.comments.map((c) => ({
      id: c.id,
      author: c.createdBy === currentUserId
        ? (user?.firstName ?? user?.username ?? 'You')
        : c.author,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }, [commentsData, user]);

  // Fetch real history from API
  const { data: historyData } = useBoardItemHistory(spaceId, boardId, task.id);
  const history: TaskHistoryEntry[] = useMemo(() => {
    if (!historyData?.history) return [];
    const currentUserId = user?.id;
    return historyData.history.map((h) => ({
      id: h.id,
      action: h.action,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.userId === currentUserId
        ? (user?.firstName ?? user?.username ?? 'You')
        : h.userName,
      changedAt: h.createdAt,
    }));
  }, [historyData, user]);

  const handleAddComment = (content: string) => {
    addCommentMutation.mutate(content);
  };

  const meta = task.metadata ?? {};
  const storyPoints = (meta.storyPoints as number) ?? 0;
  const labels = Array.isArray(meta.labels) ? (meta.labels as string[]) : [];

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTitleDraft(task.title); setDescDraft(task.description ?? ''); }, [task]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDesc) descRef.current?.focus(); }, [editingDesc]);

  if (!mounted || !isOpen) return null;

  const saveTitle = () => { setEditingTitle(false); if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() }); else setTitleDraft(task.title); };
  const saveDesc = () => { setEditingDesc(false); if (descDraft !== (task.description ?? '')) onUpdate({ ...task, description: descDraft }); };
  const updateMeta = (partial: Record<string, unknown>) => onUpdate({ ...task, metadata: { ...meta, ...partial } });

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-3" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center rounded-md bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[11px] font-bold tracking-wide mb-2">{task.taskKey}</span>
            <div className="group/title">
              {editingTitle ? (
                <input ref={titleRef} value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); } }}
                  className="w-full text-xl sm:text-2xl font-bold text-gray-900 dark:text-brand-off-white bg-transparent border-b-2 border-brand-light-pink/60 focus-visible:outline-none pb-1" />
              ) : (
                <button type="button" onClick={() => setEditingTitle(true)} className="flex items-center gap-2 w-full text-left">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-brand-off-white">{task.title}</h2>
                  <Pencil className="h-4 w-4 text-gray-400 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-gray-200 dark:border-brand-mid-pink/15" />

        {/* ── Two-column body ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">

          {/* Left — description, story points, labels, activity */}
          <div className="px-6 sm:px-8 py-6 border-r-0 lg:border-r border-gray-200 dark:border-brand-mid-pink/15 min-h-[50vh]">

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Description</h3>
              <div className="group/desc">
                {editingDesc ? (
                  <div>
                    <textarea ref={descRef} value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={5} placeholder="Add a description..."
                      className="w-full rounded-xl border border-brand-light-pink/40 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60 resize-none" />
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={saveDesc} className="px-3 py-1.5 rounded-lg bg-brand-light-pink text-white text-xs font-medium hover:bg-brand-mid-pink">Save</button>
                      <button type="button" onClick={() => { setDescDraft(task.description ?? ''); setEditingDesc(false); }} className="px-3 py-1.5 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingDesc(true)} className="flex items-start gap-2 w-full text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap flex-1">{task.description || <span className="text-gray-400 italic">Click to add a description...</span>}</p>
                    <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover/desc:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Story Points + Labels (inline, Kanban-specific) */}
            <div className="mb-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Story Points</span>
                <span className="inline-flex items-center justify-center rounded-md bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-xs font-bold min-w-[28px] text-center">{storyPoints}</span>
              </div>
              {labels.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  {labels.map((l) => (
                    <span key={l} className="inline-flex items-center rounded-full bg-violet-500/10 text-violet-500 px-2 py-0.5 text-[10px] font-medium">{l}</span>
                  ))}
                </div>
              )}
            </div>

            <ActivityFeed
              comments={comments}
              history={history}
              onAddComment={handleAddComment}
              currentUserName={user?.firstName ?? user?.username ?? 'User'}
              isLoading={commentsLoading}
            />
          </div>

          {/* Right — classic Jira sidebar */}
          <div className="px-6 py-6 bg-gray-50/70 dark:bg-gray-950/60 space-y-5">
            <div>
              <SidebarLabel icon={ListTodo} label="Status" />
              <span className="inline-flex items-center rounded-lg bg-brand-blue/10 text-brand-blue px-2.5 py-1 text-xs font-medium">{columnTitle}</span>
            </div>
            <div>
              <SidebarLabel icon={User} label="Assignee" />
              <EditableField value={task.assignee ?? ''} placeholder="Unassigned" onSave={(v) => onUpdate({ ...task, assignee: v || undefined })} />
            </div>
            <div>
              <SidebarLabel icon={UserCircle} label="Reporter" />
              <EditableField value={task.reporter ?? ''} placeholder="None" onSave={(v) => onUpdate({ ...task, reporter: v || undefined })} />
            </div>
            <div>
              <SidebarLabel icon={Flag} label="Priority" />
              <SelectField value={task.priority ?? ''} options={PRIORITY_OPTIONS.filter(Boolean) as string[]} onSave={(v) => onUpdate({ ...task, priority: v as BoardTask['priority'] })}
                renderOption={(v) => (<span className="flex items-center gap-2 text-sm text-gray-800 dark:text-brand-off-white"><span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[v] ?? 'bg-gray-400'}`} />{v || <span className="text-gray-400 italic">None</span>}</span>)} />
            </div>
            <div>
              <SidebarLabel icon={CalendarClock} label="Start date" />
              <EditableField value={task.startDate ?? ''} type="date" placeholder="Not set" onSave={(v) => onUpdate({ ...task, startDate: v || undefined })} />
            </div>
            <div>
              <SidebarLabel icon={CalendarDays} label="Due date" />
              <EditableField value={task.dueDate ?? ''} type="date" placeholder="Not set" onSave={(v) => onUpdate({ ...task, dueDate: v || undefined })} />
            </div>
            <div>
              <SidebarLabel icon={Hash} label="Story Points" />
              <EditableField value={String(storyPoints)} placeholder="0" onSave={(v) => updateMeta({ storyPoints: Number(v) || 0 })} />
            </div>
            <div>
              <SidebarLabel icon={Tag} label="Tags" />
              {task.tags && task.tags.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">{task.tags.map((t) => (<span key={t} className="inline-flex items-center rounded-full bg-brand-light-pink/10 text-brand-light-pink px-2 py-0.5 text-[10px] font-medium">{t}</span>))}</div>
              ) : (<span className="text-xs text-gray-400 italic">No tags</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
