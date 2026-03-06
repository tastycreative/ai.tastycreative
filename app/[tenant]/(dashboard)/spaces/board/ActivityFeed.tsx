'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, History, ListTodo, Plus } from 'lucide-react';
import type { SpaceMember } from '@/lib/hooks/useSpaceMembers.query';
import { extractMentionedClerkIds } from '@/lib/mention-utils';
import { MentionDropdown, type MentionDropdownHandle } from './MentionDropdown';
import { CommentContent } from './CommentContent';

type ActivityTab = 'all' | 'comments' | 'history';

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  photoContext?: {
    index: number;
    name: string;
    url: string;
  };
}

export interface TaskHistoryEntry {
  id: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
}

interface ActivityFeedProps {
  comments: TaskComment[];
  history: TaskHistoryEntry[];
  onAddComment: (content: string) => void;
  currentUserName?: string;
  currentUserClerkId?: string;
  members?: SpaceMember[];
  isLoading?: boolean;
  onPhotoClick?: (photoIndex: number) => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  columnId: 'status',
  priority: 'priority',
  assigneeId: 'assignee',
  dueDate: 'due date',
  position: 'position',
};

function formatFieldName(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  // metadata.scheduledDate → scheduled date
  if (field.startsWith('metadata.')) {
    const key = field.replace('metadata.', '');
    return key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  }
  return field;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getMemberDisplayName(member: SpaceMember): string {
  const u = member.user;
  return u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
}

export function ActivityFeed({
  comments,
  history,
  onAddComment,
  currentUserName,
  currentUserClerkId,
  members,
  isLoading = false,
  onPhotoClick,
}: ActivityFeedProps) {
  const [tab, setTab] = useState<ActivityTab>('all');
  const [newComment, setNewComment] = useState('');

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<MentionDropdownHandle>(null);

  const handleAdd = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment('');
    setMentionQuery(null);
  };

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setNewComment(value);

      if (!members || members.length === 0) return;

      const cursorPos = e.target.selectionStart;
      // Look backward from cursor for an unmatched @
      const textBeforeCursor = value.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex === -1) {
        setMentionQuery(null);
        return;
      }

      // @ must be at start or preceded by whitespace
      if (atIndex > 0 && !/\s/.test(textBeforeCursor[atIndex - 1])) {
        setMentionQuery(null);
        return;
      }

      const query = textBeforeCursor.slice(atIndex + 1);
      // Close dropdown if there's a space followed by another space (user moved on)
      if (query.includes('\n')) {
        setMentionQuery(null);
        return;
      }

      setMentionQuery(query);
      setMentionStartIndex(atIndex);

      // Position dropdown below the textarea
      const textarea = textareaRef.current;
      if (textarea) {
        setDropdownPosition({
          top: textarea.offsetHeight + 4,
          left: 0,
        });
      }
    },
    [members]
  );

  const handleMentionSelect = useCallback(
    (member: SpaceMember) => {
      const displayName = getMemberDisplayName(member);
      const mention = `@[${displayName}](${member.user.clerkId}) `;
      const before = newComment.slice(0, mentionStartIndex);
      const cursorPos = textareaRef.current?.selectionStart ?? newComment.length;
      const after = newComment.slice(cursorPos);
      const updated = before + mention + after;

      setNewComment(updated);
      setMentionQuery(null);

      // Refocus textarea and set cursor after mention
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          const pos = before.length + mention.length;
          ta.setSelectionRange(pos, pos);
        }
      });
    },
    [newComment, mentionStartIndex]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Delegate to dropdown first if open
      if (mentionQuery !== null && dropdownRef.current) {
        const handled = dropdownRef.current.handleKeyDown(e);
        if (handled) return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
    },
    [mentionQuery, handleAdd]
  );

  // Filter out current user from mentionable members
  const mentionableMembers = members?.filter((m) => m.user.clerkId !== currentUserClerkId) ?? [];

  // Track already-mentioned clerk IDs in the current comment
  const alreadyMentionedIds = useMemo(() => extractMentionedClerkIds(newComment), [newComment]);

  // Get the first letter of the current user's name for the avatar
  const userInitial = currentUserName?.charAt(0).toUpperCase() || 'U';

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
            {userInitial}
          </span>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Add a comment... Use @ to mention"
              className="w-full rounded-xl border border-gray-200 dark:border-brand-mid-pink/20 bg-white/80 dark:bg-gray-900/60 px-3 py-2 text-xs text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60 resize-none"
            />
            {mentionQuery !== null && (
              <MentionDropdown
                ref={dropdownRef}
                members={mentionableMembers}
                query={mentionQuery}
                position={dropdownPosition}
                onSelect={handleMentionSelect}
                onClose={() => setMentionQuery(null)}
                excludeClerkIds={alreadyMentionedIds}
              />
            )}
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
        {isLoading ? (
          // Skeleton loader
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2.5 animate-pulse">
                <div className="shrink-0 h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
                    <div className="h-2 w-12 bg-gray-200 dark:bg-gray-800 rounded" />
                  </div>
                  <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
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
                        {c.photoContext && (
                          <button
                            type="button"
                            onClick={() => onPhotoClick?.(c.photoContext!.index - 1)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-brand-light-pink/10 text-brand-light-pink border border-brand-light-pink/20 hover:bg-brand-light-pink/20 transition-colors"
                            title={`View ${c.photoContext.name}`}
                          >
                            <span>📷</span>
                            <span>{c.photoContext.name}</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        <CommentContent content={c.content} />
                      </p>
                    </div>
                  </div>
                );
              }

              const h = item as TaskHistoryEntry & { _type: 'history' };
              const isCreated = h.action === 'CREATED';
              const IconEl = isCreated ? Plus : History;
              const fieldLabel = formatFieldName(h.field);

              return (
                <div key={h.id} className="flex items-start gap-2.5">
                  <span className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${isCreated ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                    <IconEl className="h-3 w-3" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-gray-800 dark:text-brand-off-white">{h.changedBy}</span>{' '}
                      {isCreated ? (
                        <>created this item</>
                      ) : (
                        <>
                          changed <span className="font-medium">{fieldLabel}</span>{' '}
                          {h.oldValue && (
                            <>
                              from <span className="line-through text-gray-400">{h.oldValue}</span>{' '}
                            </>
                          )}
                          to <span className="font-medium text-brand-light-pink">{h.newValue}</span>
                        </>
                      )}
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
          </>
        )}
      </div>
    </div>
  );
}
