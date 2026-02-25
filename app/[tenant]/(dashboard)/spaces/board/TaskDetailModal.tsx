'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@clerk/nextjs';
import { X, Pencil } from 'lucide-react';
import type { BoardTask } from './BoardTaskCard';
import { ActivityFeed, type TaskComment, type TaskHistoryEntry } from './ActivityFeed';
import { TaskSidebar } from './TaskSidebar';

interface TaskDetailModalProps {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

const PLACEHOLDER_HISTORY: TaskHistoryEntry[] = [
  { id: 'h1', field: 'priority', oldValue: 'Low', newValue: 'High', changedBy: 'Alex', changedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'h2', field: 'assignee', oldValue: '', newValue: 'Alex', changedBy: 'System', changedAt: new Date(Date.now() - 172800000).toISOString() },
];

const INITIAL_COMMENTS: TaskComment[] = [
  { id: 'c1', author: 'Jordan', content: 'Let me know if you need help breaking this down into subtasks.', createdAt: new Date(Date.now() - 43200000).toISOString() },
];

/**
 * Generic task detail modal (used by the old KanbanBoard for backward compat).
 * Template-specific modals live in [slug]/templates/ instead.
 */
export function TaskDetailModal({ task, columnTitle, isOpen, onClose, onUpdate }: TaskDetailModalProps) {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description ?? '');
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTitleDraft(task.title); setDescDraft(task.description ?? ''); }, [task]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDescription) descRef.current?.focus(); }, [editingDescription]);

  if (!mounted || !isOpen) return null;

  const saveTitle = () => { setEditingTitle(false); if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() }); else setTitleDraft(task.title); };
  const saveDescription = () => { setEditingDescription(false); if (descDraft !== (task.description ?? '')) onUpdate({ ...task, description: descDraft }); };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-3" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>

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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div className="px-6 sm:px-8 py-6 border-r-0 lg:border-r border-gray-200 dark:border-brand-mid-pink/15 min-h-[50vh]">
            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Description</h3>
              <div className="group/desc">
                {editingDescription ? (
                  <div>
                    <textarea ref={descRef} value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={5} placeholder="Add a description..."
                      className="w-full rounded-xl border border-brand-light-pink/40 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60 resize-none" />
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={saveDescription} className="px-3 py-1.5 rounded-lg bg-brand-light-pink text-white text-xs font-medium hover:bg-brand-mid-pink">Save</button>
                      <button type="button" onClick={() => { setDescDraft(task.description ?? ''); setEditingDescription(false); }} className="px-3 py-1.5 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingDescription(true)} className="flex items-start gap-2 w-full text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap flex-1">{task.description || <span className="text-gray-400 italic">Click to add a description...</span>}</p>
                    <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover/desc:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </button>
                )}
              </div>
            </div>
            <ActivityFeed
              comments={comments}
              history={PLACEHOLDER_HISTORY}
              onAddComment={(c) => setComments((p) => [{ id: `c-${Date.now()}`, author: user?.firstName ?? user?.username ?? 'User', content: c, createdAt: new Date().toISOString() }, ...p])}
              currentUserName={user?.firstName ?? user?.username ?? 'User'}
            />
          </div>
          <div className="px-6 py-6 bg-gray-50/70 dark:bg-gray-950/60">
            <TaskSidebar task={task} columnTitle={columnTitle} onUpdate={onUpdate} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
