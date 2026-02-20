'use client';

import { useState } from 'react';
import { MessageSquare, History, ListTodo } from 'lucide-react';

type ActivityTab = 'all' | 'comments' | 'history';

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface TaskHistoryEntry {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

interface ActivityFeedProps {
  comments: TaskComment[];
  history: TaskHistoryEntry[];
  onAddComment: (content: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ActivityFeed({ comments, history, onAddComment }: ActivityFeedProps) {
  const [tab, setTab] = useState<ActivityTab>('all');
  const [newComment, setNewComment] = useState('');

  const handleAdd = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment('');
  };

  const allItems = tab === 'comments'
    ? comments.map((c) => ({ ...c, _type: 'comment' as const }))
    : tab === 'history'
      ? history.map((h) => ({ ...h, _type: 'history' as const }))
      : [
          ...comments.map((c) => ({ ...c, _type: 'comment' as const })),
          ...history.map((h) => ({ ...h, _type: 'history' as const })),
        ].sort((a, b) => {
          const aDate = 'createdAt' in a ? a.createdAt : a.changedAt;
          const bDate = 'createdAt' in b ? b.createdAt : b.changedAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

  const TABS = [
    { id: 'all' as const, label: 'All', icon: ListTodo },
    { id: 'comments' as const, label: 'Comments', icon: MessageSquare },
    { id: 'history' as const, label: 'History', icon: History },
  ];

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        Activity
      </h3>

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-brand-mid-pink/15 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors rounded-t-lg',
              tab === t.id
                ? 'text-brand-light-pink bg-brand-light-pink/5'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
            ].join(' ')}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-brand-light-pink rounded-full" />
            )}
          </button>
        ))}
      </div>

      {(tab === 'all' || tab === 'comments') && (
        <div className="flex items-start gap-2.5 mb-4">
          <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue text-[10px] font-bold mt-0.5">
            Y
          </span>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
              }}
              rows={2}
              placeholder="Add a comment..."
              className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-3 py-2 text-xs text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60 resize-none"
            />
            {newComment.trim() && (
              <button
                type="button"
                onClick={handleAdd}
                className="mt-1.5 px-3 py-1 rounded-lg bg-brand-light-pink text-white text-[11px] font-medium hover:bg-brand-mid-pink"
              >
                Save
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {allItems.map((item) => {
          if (item._type === 'comment') {
            const c = item as TaskComment & { _type: 'comment' };
            return (
              <div key={c.id} className="flex items-start gap-2.5">
                <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue text-[10px] font-bold">
                  {c.author.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-800 dark:text-brand-off-white">
                      {c.author}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{c.content}</p>
                </div>
              </div>
            );
          }

          const h = item as TaskHistoryEntry & { _type: 'history' };
          return (
            <div key={h.id} className="flex items-start gap-2.5">
              <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold">
                <History className="h-3 w-3" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold text-gray-800 dark:text-brand-off-white">{h.changedBy}</span>{' '}
                  changed <span className="font-medium">{h.field}</span>{' '}
                  {h.oldValue && (
                    <>
                      from <span className="line-through text-gray-400">{h.oldValue}</span>{' '}
                    </>
                  )}
                  to <span className="font-medium text-brand-light-pink">{h.newValue}</span>
                </p>
                <span className="text-[10px] text-gray-400">{formatDate(h.changedAt)}</span>
              </div>
            </div>
          );
        })}

        {allItems.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            No activity yet.
          </p>
        )}
      </div>
    </div>
  );
}
