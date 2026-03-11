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

// Only a few well-known overrides — everything else is derived dynamically
const FIELD_LABELS: Record<string, string> = {
  columnId: 'status',
  assigneeId: 'assignee',
  dueDate: 'due date',
};

/** Dynamically turn any field key into a readable label.
 *  e.g. "metadata.qaApprovedBy" → "qa approved by"
 *       "captionItems"          → "caption items"
 *       "columnId"              → "status" (via override)
 */
function formatFieldName(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  // Strip metadata. prefix
  const key = field.startsWith('metadata.') ? field.replace('metadata.', '') : field;
  // camelCase / PascalCase → space-separated lowercase, strip trailing "Id"
  return key
    .replace(/Id$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
}

/** Returns true for internal/noise fields that shouldn't appear in the feed */
function isHiddenField(field: string): boolean {
  const key = field.startsWith('metadata.') ? field.replace('metadata.', '') : field;
  // Hide position (DnD reordering), any underscore-prefixed internal keys
  if (field === 'position') return true;
  if (key.startsWith('_')) return true;
  // Hide large structural metadata that produces noise (ordering arrays, full form data)
  if (key === 'fieldOrder' || key === 'fields') return true;
  return false;
}

/** Summarize an array for display */
function formatArray(arr: unknown[]): string {
  // Empty
  if (arr.length === 0) return 'none';
  // Array of primitives (tags, hashtags, etc.) — show values if short
  if (arr.every((v) => typeof v === 'string' || typeof v === 'number')) {
    const joined = (arr as (string | number)[]).join(', ');
    if (joined.length <= 60) return joined;
    return `${arr.length} item${arr.length !== 1 ? 's' : ''}`;
  }
  // Array of objects with 'text' (checklist) — show completed count
  if (arr.every((v) => typeof v === 'object' && v !== null && 'text' in v)) {
    const completed = arr.filter((v) => (v as { completed?: boolean }).completed).length;
    return `${completed}/${arr.length} completed`;
  }
  // Array of objects with 'fileName' (captionItems, media) — show count
  if (arr.every((v) => typeof v === 'object' && v !== null && 'fileName' in v)) {
    return `${arr.length} file${arr.length !== 1 ? 's' : ''}`;
  }
  // Generic array of objects
  return `${arr.length} item${arr.length !== 1 ? 's' : ''}`;
}

/** Dynamically clean up any raw history value for display.
 *  Handles [object Object], clerk IDs, ISO dates, JSON arrays, booleans, etc.
 */
function formatHistoryValue(field: string, value: string | null): string | null {
  if (value == null || value === '') return null;

  // [object Object] — legacy data stored via String() on arrays
  if (value.includes('[object Object]')) {
    const count = value.split('[object Object]').length - 1;
    return `${count} item${count !== 1 ? 's' : ''}`;
  }

  // JSON arrays → parse and summarize
  if (value.startsWith('[')) {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return formatArray(arr);
    } catch { /* not JSON, fall through */ }
  }

  // JSON objects → show key count
  if (value.startsWith('{')) {
    try {
      const obj = JSON.parse(value);
      if (typeof obj === 'object' && obj !== null) {
        const keys = Object.keys(obj);
        return `${keys.length} field${keys.length !== 1 ? 's' : ''}`;
      }
    } catch { /* not JSON, fall through */ }
  }

  // Clerk user IDs (user_xxx...)
  if (/^user_[a-zA-Z0-9]+$/.test(value)) {
    return 'a user';
  }

  // ISO date strings → readable format
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(value)) {
    try {
      return new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  }

  // UPPER_SNAKE_CASE status values (PENDING_CAPTION, COMPLETED, etc.)
  if (/^[A-Z][A-Z0-9_]+$/.test(value)) {
    return value.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // snake_case on status-like fields (in_progress, pending_qa, etc.)
  const fieldKey = field.startsWith('metadata.') ? field.slice(9) : field;
  if (/^[a-z][a-z0-9_]+$/.test(value) && fieldKey.toLowerCase().includes('status')) {
    return value.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // Boolean-like strings
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';

  // Prisma cuid IDs — not useful
  if (/^c[a-z0-9]{20,}$/.test(value)) return null;

  return value;
}

/** Detect if a checklist history value is a self-contained action description
 *  (e.g. 'Added "STEP"', 'Completed "STEP"', 'Reordered steps') */
function isChecklistActionValue(value: string | null): boolean {
  if (!value) return false;
  return /^(Added|Removed|Completed|Unchecked|Reordered) /.test(value);
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
      // Close dropdown if user typed a space or newline (moved on from mention)
      if (query.includes(' ') || query.includes('\n')) {
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

  // Filter out hidden/noise fields from history
  const filteredHistory = history.filter((h) => !isHiddenField(h.field));

  const allItems = tab === 'comments'
    ? comments.map((c) => ({ ...c, _type: 'comment' as const }))
    : tab === 'history'
      ? filteredHistory.map((h) => ({ ...h, _type: 'history' as const }))
      : [
          ...comments.map((c) => ({ ...c, _type: 'comment' as const })),
          ...filteredHistory.map((h) => ({ ...h, _type: 'history' as const })),
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
              const isChecklistAction = h.field === 'checklist' && isChecklistActionValue(h.newValue || h.oldValue);
              const IconEl = isCreated ? Plus : History;
              const fieldLabel = formatFieldName(h.field);
              const displayOld = formatHistoryValue(h.field, h.oldValue);
              const displayNew = formatHistoryValue(h.field, h.newValue);

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
                      ) : isChecklistAction ? (
                        // Checklist entries: value is already a readable action like 'Added "STEP"'
                        <>
                          {displayOld && !displayNew ? (
                            <span className="text-gray-400">{displayOld}</span>
                          ) : (
                            <span className="font-medium text-brand-light-pink">{displayNew}</span>
                          )}
                        </>
                      ) : (
                        <>
                          changed <span className="font-medium">{fieldLabel}</span>{' '}
                          {displayOld && (
                            <>
                              from <span className="line-through text-gray-400">{displayOld}</span>{' '}
                            </>
                          )}
                          {displayNew ? (
                            <>to <span className="font-medium text-brand-light-pink">{displayNew}</span></>
                          ) : (
                            <span className="italic text-gray-400">(cleared)</span>
                          )}
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
