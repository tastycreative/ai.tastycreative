'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  User,
  CalendarDays,
  FileText,
  History,
  MessageSquare,
  Plus,
  Info,
  Clock,
  ChevronDown,
  Image as ImageIcon,
  Search,
  Check,
  FolderOpen,
  Clapperboard,
  Hash,
  Users,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { useOrgMembers, useCurrentOrgRole } from '@/lib/hooks/useOrgMembers.query';
import { MentionDropdown, type MentionDropdownHandle } from '../../board/MentionDropdown';
import { CommentContent } from '../../board/CommentContent';
import { extractMentionedClerkIds } from '@/lib/mention-utils';
import {
  useBoardItemComments,
  useAddComment,
  useBoardItemHistory,
} from '@/lib/hooks/useBoardItems.query';
import {
  CONTENT_GEN_TASK_TYPE_OPTIONS,
  type ContentGenTaskType,
  type VaultAssetRef,
} from '@/lib/spaces/template-metadata';
import { VaultAssetPicker } from '@/components/spaces/VaultAssetPicker';

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  task: BoardTask;
  columnTitle: string;
  columns?: { id: string; name: string }[];
  onColumnChange?: (columnId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

type ModalTab = 'details' | 'vault' | 'activity';

/* ── Constants ───────────────────────────────────────────── */

const TASK_TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  IG_SFW_REELS: { bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400' },
  NSFW_PPV: { bg: 'bg-rose-500/15 border-rose-500/25', text: 'text-rose-400' },
  WALL_POSTS: { bg: 'bg-violet-500/15 border-violet-500/25', text: 'text-violet-400' },
  STORIES: { bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' },
  PROMO: { bg: 'bg-emerald-500/15 border-emerald-500/25', text: 'text-emerald-400' },
  CUSTOM: { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' },
};

const SECTION_THEMES: Record<string, { border: string; iconBg: string; iconColor: string; gradientFrom: string }> = {
  'Task Information': { border: 'border-brand-blue/30', iconBg: 'bg-brand-blue/15', iconColor: 'text-brand-blue', gradientFrom: 'from-brand-blue/[0.06]' },
  'Vault Assets': { border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', gradientFrom: 'from-emerald-500/[0.06]' },
  'Notes': { border: 'border-violet-500/30', iconBg: 'bg-violet-500/15', iconColor: 'text-violet-400', gradientFrom: 'from-violet-500/[0.06]' },
  'Timestamps': { border: 'border-gray-500/30', iconBg: 'bg-gray-500/15', iconColor: 'text-gray-400', gradientFrom: 'from-gray-500/[0.06]' },
};

const DEFAULT_THEME = { border: 'border-white/[0.08]', iconBg: 'bg-white/[0.06]', iconColor: 'text-gray-400', gradientFrom: 'from-white/[0.03]' };

/* ── Section — collapsible glassmorphism card ──────────── */

function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const themeKey = Object.keys(SECTION_THEMES).find(k => title.startsWith(k)) ?? '';
  const theme = SECTION_THEMES[themeKey] ?? DEFAULT_THEME;

  return (
    <div className={`mb-3 rounded-xl border ${theme.border} bg-gradient-to-br ${theme.gradientFrom} to-transparent backdrop-blur-sm overflow-hidden transition-all duration-200`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center w-full gap-2.5 py-3 px-4 text-left group/section hover:bg-white/[0.02] transition-colors"
      >
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${theme.iconBg} shrink-0`}>
          <Icon className={`h-3.5 w-3.5 ${theme.iconColor}`} />
        </span>
        <span className="text-[12px] font-semibold text-gray-300 tracking-wide flex-1">
          {title}
        </span>
        {badge}
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0.5 pl-[52px]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar helpers ─────────────────────────────────────── */

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 mb-1">
      {children}
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-white/[0.04] last:border-0">
      <SideLabel>{label}</SideLabel>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

/* ── Custom dark column select ───────────────────────────── */

function ColumnSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] px-2.5 py-1.5 text-xs text-white transition-colors"
      >
        <span>{selected?.name ?? 'Select…'}</span>
        <ChevronDown
          className={`h-3 w-3 text-gray-500 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-white/[0.08] bg-[#111113] shadow-xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-white/[0.06] ${
                opt.id === value
                  ? 'text-brand-light-pink font-semibold'
                  : 'text-gray-300'
              }`}
            >
              {opt.id === value ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Empty / skeleton ────────────────────────────────────── */

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2">
      <Icon className="h-5 w-5 text-gray-700" />
      <p className="text-xs text-gray-600">{text}</p>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 animate-pulse py-3">
          <div className="shrink-0 h-7 w-7 rounded-full bg-white/[0.05]" />
          <div className="flex-1 min-w-0 space-y-2 py-1">
            <div className="h-3 w-24 bg-white/[0.05] rounded" />
            <div className="h-3 w-3/4 bg-white/[0.04] rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-brand-light-pink/12 text-brand-light-pink',
  'bg-brand-blue/12 text-brand-blue',
  'bg-emerald-500/12 text-emerald-400',
  'bg-violet-500/12 text-violet-400',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  if (field.startsWith('metadata.')) {
    const key = field.replace('metadata.', '');
    return key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  }
  return field;
}

function getDateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/* ══════════════════════════════════════════════════════════ */
/*  Main Modal                                                */
/* ══════════════════════════════════════════════════════════ */

export function ContentGenTaskDetailModal({
  task,
  columnTitle,
  columns,
  onColumnChange,
  isOpen,
  onClose,
  onUpdate,
}: Props) {
  const params = useParams<{ tenant: string; slug: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { data: orgMembers = [] } = useOrgMembers();
  const { data: currentOrgRole } = useCurrentOrgRole();
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;
  const { data: spaceMembers } = useSpaceMembers(spaceId);

  const getMemberName = (id?: string) => {
    if (!id) return undefined;
    const m = orgMembers.find((mb) => mb.clerkId === id || mb.id === id);
    if (!m) return undefined;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  };

  const [activeTab, setActiveTab] = useState<ModalTab>('details');
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [assigneesDropdownOpen, setAssigneesDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeDropdownPos, setAssigneeDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'comments' | 'changes'>('all');
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  const lastActivityViewRef = useRef<number>(Date.now());
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<MentionDropdownHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const assigneesDropdownRef = useRef<HTMLDivElement>(null);
  const assigneesTriggerRef = useRef<HTMLButtonElement>(null);
  const alreadyMentionedIds = useMemo(() => extractMentionedClerkIds(newComment), [newComment]);

  /* ── Metadata ────────────────────────────────────────── */

  const meta = task.metadata ?? {};
  const taskType = (meta.taskType as ContentGenTaskType) ?? 'CUSTOM';
  const quantity = (meta.quantity as number) ?? 1;
  const clientId = (meta.clientId as string) ?? '';
  const clientName = (meta.clientName as string) ?? '';
  const assignedTo = Array.isArray(meta.assignedTo) ? (meta.assignedTo as string[]) : [];
  const vaultAssets = Array.isArray(meta.vaultAssets) ? (meta.vaultAssets as VaultAssetRef[]) : [];
  const notes = (meta.notes as string) ?? '';
  const deadline = (meta.deadline as string) ?? '';
  const requestedBy = (meta.requestedBy as string) ?? '';
  const requestedByName = (meta.requestedByName as string) ?? '';
  const createdAt = typeof meta._createdAt === 'string' ? meta._createdAt : '';
  const updatedAt = typeof meta._updatedAt === 'string' ? meta._updatedAt : '';

  const [notesDraft, setNotesDraft] = useState(notes);

  const taskTypeLabel = CONTENT_GEN_TASK_TYPE_OPTIONS.find(o => o.value === taskType)?.label ?? taskType;
  const typeBadge = TASK_TYPE_BADGE[taskType] ?? TASK_TYPE_BADGE.CUSTOM;

  /* ── Submit validation ─────────────────────────────────── */

  const isReviewColumn = columnTitle.toLowerCase().includes('review');
  const isAssignedColumn = columnTitle.toLowerCase() === 'assigned';
  const isInProgressColumn = columnTitle.toLowerCase().includes('in progress');
  const isRevisionColumn = columnTitle.toLowerCase().includes('revision');
  const canSubmitToReview = vaultAssets.length > 0;

  /* ── API hooks ───────────────────────────────────────── */

  const { data: commentsData, isLoading: commentsLoading } =
    useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(spaceId ?? '', boardId ?? '', task.id);
  const { data: historyData, isLoading: historyLoading } =
    useBoardItemHistory(spaceId, boardId, task.id);

  const comments = useMemo(() => {
    if (!commentsData?.comments) return [];
    const uid = user?.id;
    return commentsData.comments.map((c) => ({
      id: c.id,
      author: c.createdBy === uid ? (user?.firstName ?? user?.username ?? 'You') : c.author,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }, [commentsData, user]);

  const historyEntries = useMemo(() => {
    if (!historyData?.history) return [];
    const uid = user?.id;
    return historyData.history.map((h) => ({
      id: h.id,
      action: h.action,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.userId === uid ? (user?.firstName ?? user?.username ?? 'You') : h.userName,
      changedAt: h.createdAt,
    }));
  }, [historyData, user]);

  /* ── Unified activity timeline ───────────────────────── */

  const activityTimeline = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'comment' | 'change';
      author: string;
      timestamp: string;
      content?: string;
      action?: string;
      field?: string;
      oldValue?: string | null;
      newValue?: string | null;
    }> = [];
    for (const c of comments) {
      items.push({ id: `c-${c.id}`, type: 'comment', author: c.author, timestamp: c.createdAt, content: c.content });
    }
    for (const h of historyEntries) {
      items.push({ id: `h-${h.id}`, type: 'change', author: h.changedBy, timestamp: h.changedAt, action: h.action, field: h.field, oldValue: h.oldValue, newValue: h.newValue });
    }
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return items;
  }, [comments, historyEntries]);

  const filteredTimeline = useMemo(() => {
    if (activityFilter === 'all') return activityTimeline;
    if (activityFilter === 'comments') return activityTimeline.filter(i => i.type === 'comment');
    return activityTimeline.filter(i => i.type === 'change');
  }, [activityTimeline, activityFilter]);

  const groupedTimeline = useMemo(() => {
    const groups: { label: string; items: typeof filteredTimeline }[] = [];
    let currentLabel = '';
    for (const item of filteredTimeline) {
      const label = getDateGroupLabel(item.timestamp);
      if (label !== currentLabel) {
        groups.push({ label, items: [item] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }, [filteredTimeline]);

  /* ── Effects ─────────────────────────────────────────── */

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setTitleDraft(task.title);
    setNotesDraft(notes);
  }, [task, notes]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingNotes) notesRef.current?.focus(); }, [editingNotes]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (assigneesDropdownOpen) { setAssigneesDropdownOpen(false); return; }
        if (!editingTitle && !editingNotes && !vaultPickerOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingTitle, editingNotes, vaultPickerOpen, assigneesDropdownOpen, onClose]);

  useEffect(() => {
    if (!assigneesDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        assigneesDropdownRef.current && !assigneesDropdownRef.current.contains(target) &&
        assigneesTriggerRef.current && !assigneesTriggerRef.current.contains(target)
      ) {
        setAssigneesDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [assigneesDropdownOpen]);

  // Track unread activity
  useEffect(() => {
    if (activeTab === 'activity') {
      lastActivityViewRef.current = Date.now();
      setHasUnreadActivity(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'activity' || !lastActivityViewRef.current) return;
    const lastViewed = lastActivityViewRef.current;
    const hasNew = activityTimeline.some(item => new Date(item.timestamp).getTime() > lastViewed);
    setHasUnreadActivity(hasNew);
  }, [activeTab, activityTimeline]);

  const filteredAssignableMembers = useMemo(() => {
    const all = spaceMembers ?? [];
    if (!assigneeSearch.trim()) return all;
    const q = assigneeSearch.toLowerCase();
    return all.filter((m) => {
      const name = getMemberDisplayName(m);
      return name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q);
    });
  }, [spaceMembers, assigneeSearch]);

  const canReview = useMemo(() => {
    const orgAllowed = ['OWNER', 'ADMIN', 'MANAGER'].includes(currentOrgRole ?? '');
    const spaceAllowed = ['OWNER', 'ADMIN'].includes(space?.currentUserRole ?? '');
    return orgAllowed || spaceAllowed;
  }, [currentOrgRole, space?.currentUserRole]);

  if (!mounted || !isOpen) return null;

  /* ── Helpers ─────────────────────────────────────────── */

  const updateMeta = (partial: Record<string, unknown>) =>
    onUpdate({ ...task, metadata: { ...meta, ...partial } });

  const handleTitleSave = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate({ ...task, title: trimmed });
    } else {
      setTitleDraft(task.title);
    }
  };

  const handleNotesSave = () => {
    setEditingNotes(false);
    if (notesDraft !== notes) {
      updateMeta({ notes: notesDraft });
    }
  };

  const handleVaultAssetsSelected = (assets: VaultAssetRef[]) => {
    updateMeta({ vaultAssets: assets });
    // Auto-promote to "In Progress" when first asset is attached while still in Assigned
    if (isAssignedColumn && assets.length > 0 && vaultAssets.length === 0) {
      const inProgressCol = columns?.find(c => c.name.toLowerCase().includes('in progress'));
      if (inProgressCol && onColumnChange) onColumnChange(inProgressCol.id);
    }
    // Auto-promote from Revision back to In Progress when assets are updated
    if (isRevisionColumn && assets.length > 0) {
      const inProgressCol = columns?.find(c => c.name.toLowerCase().includes('in progress'));
      if (inProgressCol && onColumnChange) onColumnChange(inProgressCol.id);
    }
  };

  const handleMoveToReview = () => {
    if (!canSubmitToReview) return;
    const reviewCol = columns?.find(c => c.name.toLowerCase().includes('review'));
    if (reviewCol && onColumnChange) {
      onColumnChange(reviewCol.id);
    }
  };

  const handleStartWorking = () => {
    const inProgressCol = columns?.find(c => c.name.toLowerCase().includes('in progress'));
    if (inProgressCol && onColumnChange) {
      onColumnChange(inProgressCol.id);
    }
  };

  const handleApprove = () => {
    const completedCol = columns?.find(c => c.name.toLowerCase().includes('completed'));
    if (completedCol && onColumnChange) onColumnChange(completedCol.id);
  };

  const handleRequestRevision = () => {
    const revisionCol = columns?.find(c => c.name.toLowerCase().includes('revision'));
    if (revisionCol && onColumnChange) {
      onColumnChange(revisionCol.id);
      if (revisionReason.trim()) {
        addCommentMutation.mutate(`📝 Revision requested: ${revisionReason.trim()}`);
      }
      setRevisionReason('');
      setShowRevisionInput(false);
    }
  };

  const handleToggleAssignee = (clerkId: string) => {
    const wasAssigned = assignedTo.includes(clerkId);
    const newList = wasAssigned
      ? assignedTo.filter((id) => id !== clerkId)
      : [...assignedTo, clerkId];
    updateMeta({ assignedTo: newList });
    // Auto-move to "Assigned" column when first assignee is added and ticket is still in Open
    if (!wasAssigned && newList.length === 1) {
      const isOpenColumn = columnTitle.toLowerCase() === 'open';
      if (isOpenColumn) {
        const assignedCol = columns?.find(c => c.name.toLowerCase().includes('assigned'));
        if (assignedCol && onColumnChange) onColumnChange(assignedCol.id);
      }
    }
  };

  const handleCommentSubmit = () => {
    const trimmed = newComment.trim();
    if (!trimmed || !user?.id) return;
    addCommentMutation.mutate(trimmed);
    setNewComment('');
    setMentionQuery(null);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionDropdownRef.current) {
      if (mentionDropdownRef.current.handleKeyDown(e)) return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleCommentSubmit();
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStartIndex(cursor - atMatch[0].length);
      const ta = commentTextareaRef.current;
      if (ta) {
        const rect = ta.getBoundingClientRect();
        setDropdownPosition({ top: rect.bottom + 4, left: rect.left });
      }
    } else {
      setMentionQuery(null);
    }
  };

  const mentionableMembers = spaceMembers?.filter((m) => m.user.clerkId !== user?.id) ?? [];

  function getMemberDisplayName(member: { user: { name: string | null; firstName: string | null; lastName: string | null; email: string } }) {
    const u = member.user;
    return u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  const handleMentionSelect = (member: (typeof mentionableMembers)[number]) => {
    const displayName = getMemberDisplayName(member);
    const mention = `@[${displayName}](${member.user.clerkId}) `;
    const before = newComment.slice(0, mentionStartIndex);
    const cursorPos = commentTextareaRef.current?.selectionStart ?? newComment.length;
    const after = newComment.slice(cursorPos);
    setNewComment(before + mention + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const ta = commentTextareaRef.current;
      if (ta) { ta.focus(); const pos = before.length + mention.length; ta.setSelectionRange(pos, pos); }
    });
  };

  /* ── Tab content ────────────────────────────────────── */

  const tabs: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'vault', label: 'Vault', icon: FolderOpen },
    { id: 'activity', label: 'Activity', icon: MessageSquare },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const tabIds = tabs.map(t => t.id);
    const idx = tabIds.indexOf(activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = e.key === 'ArrowRight'
        ? (idx + 1) % tabIds.length
        : (idx - 1 + tabIds.length) % tabIds.length;
      setActiveTab(tabIds[next]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal container */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] m-4 flex rounded-2xl border border-white/[0.06] bg-[#0a0a0b]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden">

        {/* ── Main content ─────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-3 mb-3">
              {/* Task type badge */}
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${typeBadge.bg} ${typeBadge.text}`}>
                <Clapperboard className="h-3 w-3" />
                {taskTypeLabel}
              </span>
              <span className="text-xs font-mono text-gray-500">{task.taskKey}</span>
              <span className="flex-1" />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Title */}
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
                  }}
                  className="flex-1 rounded-lg bg-white/5 border border-brand-mid-pink/30 px-3 py-2 text-lg font-bold text-white focus-visible:outline-none focus-visible:border-brand-light-pink/60"
                />
              </div>
            ) : (
              <h2
                className="text-lg font-bold text-white group cursor-pointer flex items-center gap-2"
                onClick={() => setEditingTitle(true)}
              >
                {task.title}
                <Pencil className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mt-4 -mb-3" role="tablist" onKeyDown={handleTabKeyDown}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-white bg-white/[0.06] border-b-2 border-brand-light-pink'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.id === 'vault' && vaultAssets.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      {vaultAssets.length}
                    </span>
                  )}
                  {tab.id === 'activity' && (
                    <>
                      {(comments.length + historyEntries.length) > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-brand-blue/20 text-brand-blue font-bold">
                          {comments.length + historyEntries.length}
                        </span>
                      )}
                      {hasUnreadActivity && activeTab !== 'activity' && (
                        <span className="ml-1 h-2 w-2 rounded-full bg-brand-light-pink animate-pulse" />
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {/* ── Details Tab ──────────────────────────── */}
            <div
              role="tabpanel"
              id="tabpanel-details"
              aria-labelledby="tab-details"
              style={{ display: activeTab === 'details' ? undefined : 'none' }}
              className="h-full overflow-y-auto px-6 py-4"
            >
              <div className="space-y-1">
                <Section icon={Info} title="Task Information">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <div className="text-[11px] text-gray-500 mb-0.5">Task Type</div>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${typeBadge.bg} ${typeBadge.text}`}>
                        {taskTypeLabel}
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-0.5">Quantity</div>
                      <span className="text-white font-semibold">{quantity}</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-0.5">Client</div>
                      <span className="text-white">{clientName || 'Not set'}</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-0.5">Deadline</div>
                      <span className={`text-white ${deadline ? '' : 'text-gray-600'}`}>
                        {deadline ? formatFullDate(deadline) : 'No deadline'}
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-0.5">Requested By</div>
                      <span className="text-white">{requestedByName || getMemberName(requestedBy) || 'Unknown'}</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 mb-0.5">Status</div>
                      <span className="text-white font-medium">{columnTitle}</span>
                    </div>
                  </div>
                </Section>

                <Section icon={Users} title="Assigned Content Generators">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {assignedTo.map((uid) => {
                      const name = getMemberName(uid) ?? uid;
                      const color = getAvatarColor(name);
                      return (
                        <span key={uid} className={`inline-flex items-center gap-1 rounded-lg pl-2 pr-1 py-1 text-xs font-medium ${color} border border-white/[0.06]`}>
                          <span className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          {name}
                          <button
                            type="button"
                            onClick={() => handleToggleAssignee(uid)}
                            className="ml-0.5 rounded p-0.5 hover:bg-white/10 transition-colors"
                            title={`Remove ${name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  {/* Add assignee */}
                  <div className="relative inline-block">
                    <button
                      ref={assigneesTriggerRef}
                      type="button"
                      onClick={() => {
                        if (!assigneesDropdownOpen) {
                          const rect = assigneesTriggerRef.current?.getBoundingClientRect();
                          if (rect) setAssigneeDropdownPos({ top: rect.bottom + 6, left: rect.left });
                        }
                        setAssigneesDropdownOpen(v => !v);
                        setAssigneeSearch('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.15] px-2.5 py-1 text-xs text-gray-500 hover:border-brand-light-pink/40 hover:text-brand-light-pink transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add assignee
                    </button>

                    {assigneesDropdownOpen && assigneeDropdownPos && createPortal(
                      <div
                        ref={assigneesDropdownRef}
                        style={{ position: 'fixed', top: assigneeDropdownPos.top, left: assigneeDropdownPos.left, zIndex: 9999 }}
                        className="w-64 rounded-xl border border-white/[0.08] bg-[#111113] shadow-2xl overflow-hidden"
                      >
                        <div className="p-2 border-b border-white/[0.06]">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                            <input
                              autoFocus
                              type="text"
                              value={assigneeSearch}
                              onChange={(e) => setAssigneeSearch(e.target.value)}
                              placeholder="Search members..."
                              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.06] pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:border-brand-mid-pink/30"
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto py-1">
                          {filteredAssignableMembers.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-gray-600">No members found</div>
                          ) : (
                            filteredAssignableMembers.map((m) => {
                              const name = getMemberDisplayName(m);
                              const isSelected = assignedTo.includes(m.user.clerkId);
                              return (
                                <button
                                  key={m.user.clerkId}
                                  type="button"
                                  onClick={() => handleToggleAssignee(m.user.clerkId)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/[0.04] transition-colors ${
                                    isSelected ? 'text-brand-light-pink' : 'text-gray-300'
                                  }`}
                                >
                                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(name)}`}>
                                    {name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="flex-1 min-w-0 flex flex-col items-start">
                                    <span className="truncate w-full">{name}</span>
                                    <span className="truncate w-full text-[10px] text-gray-500">{m.user.email}</span>
                                  </span>
                                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </Section>

                <Section icon={FileText} title="Notes">
                  {editingNotes ? (
                    <textarea
                      ref={notesRef}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      onBlur={handleNotesSave}
                      rows={4}
                      className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:border-brand-mid-pink/30 resize-none"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingNotes(true)}
                      className="text-sm text-gray-300 cursor-pointer hover:bg-white/[0.02] rounded-lg px-2 py-1.5 -mx-2 transition-colors min-h-[40px]"
                    >
                      {notes || <span className="text-gray-600 italic">Click to add notes...</span>}
                    </div>
                  )}
                </Section>

                <Section icon={Clock} title="Timestamps" defaultOpen={false}>
                  <div className="text-xs space-y-1.5 text-gray-400">
                    {createdAt && <div>Created: {formatFullDate(createdAt)}</div>}
                    {updatedAt && <div>Updated: {formatFullDate(updatedAt)}</div>}
                  </div>
                </Section>

                {/* Start Working button */}
                {isAssignedColumn && (
                  <div className="mt-4 p-4 rounded-xl border border-brand-light-pink/20 bg-brand-light-pink/[0.05]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Start Working</div>
                        <div className="text-xs text-gray-400 mt-0.5">Mark this ticket as in progress</div>
                      </div>
                      <button
                        onClick={handleStartWorking}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-brand-light-pink text-white hover:bg-brand-mid-pink shadow-lg shadow-brand-light-pink/20"
                      >
                        Start
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit to Review gate */}
                {!isReviewColumn && !isAssignedColumn && (
                  <div className="mt-4 p-4 rounded-xl border border-brand-blue/20 bg-brand-blue/[0.05]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Submit for Review</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {canSubmitToReview
                            ? `${vaultAssets.length} asset${vaultAssets.length !== 1 ? 's' : ''} attached — ready to submit`
                            : 'Attach vault assets before submitting for review'}
                        </div>
                      </div>
                      <button
                        onClick={handleMoveToReview}
                        disabled={!canSubmitToReview}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          canSubmitToReview
                            ? 'bg-brand-blue text-white hover:bg-brand-blue/80 shadow-lg shadow-brand-blue/20'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}

                {/* Review decision — only visible to org OWNER/ADMIN/MANAGER or space OWNER/ADMIN */}
                {isReviewColumn && canReview && (
                  <div className="mt-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/4">
                    <div className="text-sm font-semibold text-white mb-3">Review Decision</div>

                    {showRevisionInput && (
                      <div className="mb-3">
                        <textarea
                          value={revisionReason}
                          onChange={(e) => setRevisionReason(e.target.value)}
                          placeholder="Reason for revision (optional)..."
                          rows={3}
                          className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:border-amber-500/40 resize-none"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleApprove}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-500/90 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => {
                          if (!showRevisionInput) {
                            setShowRevisionInput(true);
                          } else {
                            handleRequestRevision();
                          }
                        }}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all"
                      >
                        {showRevisionInput ? 'Send Revision' : '↩ Request Revision'}
                      </button>
                    </div>

                    {showRevisionInput && (
                      <button
                        onClick={() => { setShowRevisionInput(false); setRevisionReason(''); }}
                        className="mt-2 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                {/* Open in Sexting Set Organizer — shows when task has vault assets */}
                {vaultAssets.length > 0 && (
                  <div className="mt-4 p-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.05]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Sexting Set Organizer</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Set up a sexting set from the generated content
                        </div>
                      </div>
                      <a
                        href={`/${params.tenant}/workspace/content-studio/sexting-set-organizer?contentGenTaskId=${task.id}${clientId ? `&clientId=${clientId}` : ''}${clientName ? `&clientName=${encodeURIComponent(clientName)}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-violet-500/90 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Vault Tab ────────────────────────────── */}
            <div
              role="tabpanel"
              id="tabpanel-vault"
              aria-labelledby="tab-vault"
              style={{ display: activeTab === 'vault' ? undefined : 'none' }}
              className="h-full overflow-y-auto px-6 py-4"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Vault Assets</h3>
                    <p className="text-xs text-gray-500">
                      {vaultAssets.length} asset{vaultAssets.length !== 1 ? 's' : ''} attached to this task
                    </p>
                  </div>
                  {clientId && (
                    <button
                      onClick={() => setVaultPickerOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Browse Vault
                    </button>
                  )}
                </div>

                {!clientId && (
                  <div className="text-center py-10 text-sm text-gray-500">
                    No client selected — vault browsing requires a client.
                  </div>
                )}

                {clientId && vaultAssets.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FolderOpen className="h-10 w-10 text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 mb-4">No assets attached yet</p>
                    <button
                      onClick={() => setVaultPickerOpen(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                    >
                      Select from Vault
                    </button>
                  </div>
                )}

                {vaultAssets.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {vaultAssets.map((asset) => {
                      const isImage = asset.fileType.startsWith('image/');
                      return (
                        <div
                          key={asset.id}
                          className="rounded-xl border border-zinc-800/50 overflow-hidden bg-zinc-900/30"
                        >
                          <div className="aspect-square bg-zinc-900/50 flex items-center justify-center overflow-hidden">
                            {isImage ? (
                              <img
                                src={asset.awsS3Url}
                                alt={asset.fileName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-zinc-600" />
                            )}
                          </div>
                          <div className="p-2">
                            <div className="text-xs text-zinc-400 truncate">{asset.fileName}</div>
                            {asset.folderName && (
                              <div className="text-[10px] text-zinc-600 truncate">{asset.folderName}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Activity Tab ─────────────────────────── */}
            <div
              role="tabpanel"
              id="tabpanel-activity"
              aria-labelledby="tab-activity"
              style={{ display: activeTab === 'activity' ? 'flex' : 'none' }}
              className="flex-col h-full"
            >
              {/* Filter toggle */}
              <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-white/[0.04]">
                {(['all', 'comments', 'changes'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActivityFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      activityFilter === filter
                        ? 'bg-white/[0.08] text-white'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'comments' ? 'Comments' : 'Changes'}
                    {filter === 'comments' && comments.length > 0 && (
                      <span className="ml-1.5 text-[10px] text-brand-blue font-bold">{comments.length}</span>
                    )}
                    {filter === 'changes' && historyEntries.length > 0 && (
                      <span className="ml-1.5 text-[10px] text-gray-400 font-bold">{historyEntries.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto px-6 py-3">
                {(commentsLoading || historyLoading) ? (
                  <ActivitySkeleton />
                ) : filteredTimeline.length === 0 ? (
                  <EmptyState
                    icon={activityFilter === 'comments' ? MessageSquare : activityFilter === 'changes' ? History : Clock}
                    text={`No ${activityFilter === 'all' ? 'activity' : activityFilter} yet`}
                  />
                ) : (
                  groupedTimeline.map((group) => (
                    <div key={group.label} className="mb-4 last:mb-0">
                      <div className="sticky top-0 z-10 flex items-center gap-3 py-1.5 mb-1 bg-[#0a0a0b]/80 backdrop-blur-sm">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">{group.label}</span>
                        <div className="flex-1 h-px bg-white/[0.04]" />
                      </div>
                      <div className="space-y-0 divide-y divide-white/[0.04]">
                        {group.items.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 py-3">
                            <div className="relative shrink-0">
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(item.author)}`}>
                                {item.author.charAt(0).toUpperCase()}
                              </div>
                              {item.type === 'comment' && (
                                <MessageSquare className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-brand-blue bg-[#0a0a0b] rounded-sm p-px" />
                              )}
                              {item.type === 'change' && (
                                <History className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-gray-500 bg-[#0a0a0b] rounded-sm p-px" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              {item.type === 'comment' ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white">{item.author}</span>
                                    <span className="text-[10px] text-gray-600">{formatDate(item.timestamp)}</span>
                                  </div>
                                  <div className="text-xs text-gray-300 mt-0.5 whitespace-pre-wrap">
                                    <CommentContent content={item.content!} />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs text-gray-300">
                                    <span className="font-semibold text-white">{item.author}</span>{' '}
                                    {item.action === 'UPDATE' && item.field
                                      ? `updated ${formatFieldName(item.field)}`
                                      : item.action === 'CREATE'
                                      ? 'created this task'
                                      : (item.action ?? '').toLowerCase()}
                                  </p>
                                  {item.oldValue && item.newValue && (
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                      <span className="line-through">{item.oldValue}</span>
                                      {' → '}
                                      <span className="text-gray-400">{item.newValue}</span>
                                    </p>
                                  )}
                                  <p className="text-[10px] text-gray-600 mt-0.5">
                                    {formatDate(item.timestamp)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sticky comment input */}
              <div className="px-6 py-3 border-t border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-sm">
                <div className="relative">
                  <textarea
                    ref={commentTextareaRef}
                    value={newComment}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Write a comment... Use @mention to notify"
                    rows={2}
                    className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:border-brand-mid-pink/30 resize-none"
                  />
                  {mentionQuery !== null && spaceMembers && (
                    <MentionDropdown
                      ref={mentionDropdownRef}
                      members={mentionableMembers}
                      query={mentionQuery}
                      position={dropdownPosition}
                      onSelect={handleMentionSelect}
                      onClose={() => setMentionQuery(null)}
                      excludeClerkIds={alreadyMentionedIds}
                    />
                  )}
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={handleCommentSubmit}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      className="px-4 py-1.5 rounded-lg bg-brand-light-pink/15 text-brand-light-pink text-xs font-semibold hover:bg-brand-light-pink/25 transition-colors disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────── */}
        <div className="w-[260px] shrink-0 border-l border-white/[0.06] bg-white/[0.02] p-5 overflow-y-auto">
          {/* Status */}
          <SideRow label="Status">
            <ColumnSelect
              value={columns?.find((c) => c.name === columnTitle)?.id ?? ''}
              options={columns ?? []}
              onChange={(id) => onColumnChange?.(id)}
            />
          </SideRow>

          {/* Task Type */}
          <SideRow label="Task Type">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${typeBadge.bg} ${typeBadge.text}`}>
              {taskTypeLabel}
            </span>
          </SideRow>

          {/* Client */}
          <SideRow label="Client">
            <span className="text-xs text-gray-200">{clientName || 'Not set'}</span>
          </SideRow>

          {/* Quantity */}
          <SideRow label="Quantity">
            <span className="text-xs text-gray-200 font-semibold">{quantity}</span>
          </SideRow>

          {/* Deadline */}
          <SideRow label="Deadline">
            {deadline ? (
              <span className="text-xs text-gray-200">{formatFullDate(deadline)}</span>
            ) : (
              <span className="text-xs text-gray-600">No deadline</span>
            )}
          </SideRow>

          {/* Assignees */}
          <SideRow label="Assignees">
            <div className="space-y-1">
              {assignedTo.length > 0 ? (
                assignedTo.map((uid) => {
                  const name = getMemberName(uid) ?? uid;
                  return (
                    <div key={uid} className="flex items-center gap-1.5">
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(name)}`}>
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-300 truncate">{name}</span>
                    </div>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => { setActiveTab('details'); setAssigneesDropdownOpen(true); }}
                  className="text-xs text-gray-600 hover:text-brand-light-pink transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Assign
                </button>
              )}
            </div>
          </SideRow>

          {/* Vault Assets count */}
          <SideRow label="Vault Assets">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${vaultAssets.length > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
                {vaultAssets.length} file{vaultAssets.length !== 1 ? 's' : ''}
              </span>
              {clientId && (
                <button
                  onClick={() => { setActiveTab('vault'); setVaultPickerOpen(true); }}
                  className="text-[10px] text-brand-blue hover:underline"
                >
                  Browse
                </button>
              )}
            </div>
          </SideRow>

          {/* Requested By */}
          <SideRow label="Requested By">
            <span className="text-xs text-gray-300">
              {requestedByName || getMemberName(requestedBy) || 'Unknown'}
            </span>
          </SideRow>
        </div>
      </div>

      {/* Vault Asset Picker */}
      {clientId && (
        <VaultAssetPicker
          isOpen={vaultPickerOpen}
          onClose={() => setVaultPickerOpen(false)}
          profileId={clientId}
          profileName={clientName}
          selectedAssets={vaultAssets}
          onAssetsSelected={handleVaultAssetsSelected}
        />
      )}
    </div>,
    document.body,
  );
}