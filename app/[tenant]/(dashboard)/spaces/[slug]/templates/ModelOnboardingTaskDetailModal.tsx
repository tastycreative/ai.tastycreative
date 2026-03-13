'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  User,
  CalendarDays,
  ClipboardList,
  Tag,
  History,
  MessageSquare,
  Plus,
  Info,
  Clock,
  ChevronDown,
  CheckSquare,
  GripVertical,
  Trash2,
  UserPlus,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import { MentionDropdown, type MentionDropdownHandle } from '../../board/MentionDropdown';
import { CommentContent } from '../../board/CommentContent';
import { extractMentionedClerkIds } from '@/lib/mention-utils';
import {
  useBoardItemComments,
  useAddComment,
  useBoardItemHistory,
} from '@/lib/hooks/useBoardItems.query';
import type { ChecklistItem } from '@/lib/spaces/template-metadata';
import { ActivityFeed } from '../../board/ActivityFeed';

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

type ModalTab = 'details' | 'formdata' | 'history' | 'comments';

/* ── Constants ───────────────────────────────────────────── */

const PLATFORM_OPTIONS = ['onlyfans', 'fansly', 'instagram', 'twitter', 'tiktok', 'other'];

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  columnId: 'status',
  priority: 'priority',
  assigneeId: 'assignee',
  dueDate: 'launching date',
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  }) + ' PST';
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  }) + ' PST';
}

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

/* ── Section — collapsible flat section ──────────────────── */

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

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center w-full gap-2 py-2.5 text-left group/section"
      >
        <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span className="text-[13px] font-semibold text-gray-200 tracking-wide flex-1 uppercase">
          {title}
        </span>
        {badge}
        <ChevronDown
          className={`h-3 w-3 text-gray-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-3 pl-5.5">
          {children}
        </div>
      )}
      <div className="border-t border-white/[0.04]" />
    </div>
  );
}

/* ── Sidebar helpers ─────────────────────────────────────── */

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-1">
      {children}
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b border-white/[0.03] last:border-0">
      <SideLabel>{label}</SideLabel>
      <div>{children}</div>
    </div>
  );
}

/* ── Skeleton / Empty ────────────────────────────────────── */

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

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2">
      <Icon className="h-5 w-5 text-gray-700" />
      <p className="text-xs text-gray-600">{text}</p>
    </div>
  );
}

/* ── Tag input helper ────────────────────────────────────── */

function TagInput({
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        placeholder={placeholder}
        className="flex-1 rounded px-2 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 bg-white/[0.03] border border-white/[0.06] focus-visible:outline-none focus-visible:border-brand-mid-pink/30"
      />
      <button
        type="button"
        onClick={onAdd}
        className="p-1 rounded text-gray-500 hover:text-brand-light-pink transition-colors"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function RemovableTag({
  children,
  onRemove,
  variant = 'default',
}: {
  children: React.ReactNode;
  onRemove: () => void;
  variant?: 'default' | 'pink' | 'blue';
}) {
  const colors = {
    default: 'bg-white/[0.04] text-gray-300 border-white/[0.06]',
    pink: 'bg-brand-light-pink/8 text-brand-light-pink border-brand-light-pink/12',
    blue: 'bg-brand-blue/8 text-brand-blue border-brand-blue/12',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border ${colors[variant]}`}>
      {children}
      <button type="button" onClick={onRemove} className="opacity-50 hover:opacity-100 transition-opacity">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

/* ── Checklist progress helper ───────────────────────────── */

function computeProgress(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const done = checklist.filter((c) => c.completed).length;
  return Math.round((done / checklist.length) * 100);
}

/* ══════════════════════════════════════════════════════════ */
/*  Main Modal                                                */
/* ══════════════════════════════════════════════════════════ */

export function ModelOnboardingTaskDetailModal({
  task,
  columnTitle,
  isOpen,
  onClose,
  onUpdate,
}: Props) {
  const params = useParams<{ slug: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { data: orgMembers = [] } = useOrgMembers();
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;
  const { data: spaceMembers } = useSpaceMembers(spaceId);

  const getMemberName = (id?: string) => {
    if (!id) return undefined;
    // Try space members first
    const sm = spaceMembers?.find((mb) => mb.user.clerkId === id);
    if (sm) return sm.user.name || `${sm.user.firstName ?? ''} ${sm.user.lastName ?? ''}`.trim() || sm.user.email;
    // Fallback to org members for display of historical assignees
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
  const [newStepText, setNewStepText] = useState('');
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<MentionDropdownHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const alreadyMentionedIds = useMemo(() => extractMentionedClerkIds(newComment), [newComment]);

  /* ── Metadata ────────────────────────────────────────── */

  const meta = task.metadata ?? {};
  const modelName = (meta.modelName as string) ?? '';
  const socialHandles = Array.isArray(meta.socialHandles) ? (meta.socialHandles as string[]) : [];
  const notes = (meta.notes as string) ?? '';
  const platform = (meta.platform as string) ?? '';
  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  const checklist: ChecklistItem[] = Array.isArray(meta.checklist) ? (meta.checklist as ChecklistItem[]) : [];
  const checklistProgress = computeProgress(checklist);
  const completedCount = checklist.filter((c) => c.completed).length;
  const dynamicFields = (meta.fields && typeof meta.fields === 'object' && !Array.isArray(meta.fields))
    ? (meta.fields as Record<string, string>)
    : {};
  // Preserve original column order from Google Sheet; fall back to Object.keys
  const fieldOrder: string[] = Array.isArray(meta.fieldOrder)
    ? (meta.fieldOrder as string[]).filter((k) => k in dynamicFields)
    : Object.keys(dynamicFields);

  const [notesDraft, setNotesDraft] = useState(notes);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

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
      if (e.key === 'Escape' && !editingTitle && !editingNotes) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingTitle, editingNotes, onClose]);

  if (!mounted || !isOpen) return null;

  /* ── Helpers ─────────────────────────────────────────── */

  const updateMeta = (partial: Record<string, unknown>) =>
    onUpdate({ ...task, metadata: { ...meta, ...partial } });

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() });
    else setTitleDraft(task.title);
  };

  const saveNotes = () => {
    setEditingNotes(false);
    if (notesDraft !== notes) updateMeta({ notes: notesDraft });
  };

  const getTagInput = (key: string) => tagInputs[key] ?? '';
  const setTagInput = (key: string, value: string) =>
    setTagInputs((prev) => ({ ...prev, [key]: value }));

  const addToArray = (field: string, value: string) => {
    const arr = Array.isArray(meta[field]) ? [...(meta[field] as string[])] : [];
    const trimmed = value.trim();
    if (trimmed && !arr.includes(trimmed)) updateMeta({ [field]: [...arr, trimmed] });
    setTagInput(field, '');
  };

  const removeFromArray = (field: string, value: string) => {
    const arr = Array.isArray(meta[field]) ? (meta[field] as string[]).filter((v) => v !== value) : [];
    updateMeta({ [field]: arr });
  };

  /* ── Checklist handlers ─────────────────────────────── */

  const toggleChecklistItem = (itemId: string) => {
    const updated = checklist.map((c) =>
      c.id === itemId
        ? {
            ...c,
            completed: !c.completed,
            completedBy: !c.completed ? user?.id : undefined,
            completedAt: !c.completed ? new Date().toISOString() : undefined,
          }
        : c,
    );
    const progress = computeProgress(updated);
    updateMeta({ checklist: updated, checklistProgress: progress });
  };

  const addChecklistItem = () => {
    if (!newStepText.trim()) return;
    const newItem: ChecklistItem = {
      id: `step-${Date.now()}`,
      text: newStepText.trim(),
      completed: false,
      order: checklist.length,
    };
    const updated = [...checklist, newItem];
    const progress = computeProgress(updated);
    updateMeta({ checklist: updated, checklistProgress: progress });
    setNewStepText('');
  };

  const removeChecklistItem = (itemId: string) => {
    const updated = checklist.filter((c) => c.id !== itemId).map((c, i) => ({ ...c, order: i }));
    const progress = computeProgress(updated);
    updateMeta({ checklist: updated, checklistProgress: progress });
  };

  const handleChecklistDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(checklist);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const reordered = items.map((c, i) => ({ ...c, order: i }));
    updateMeta({ checklist: reordered });
  };

  const updateChecklistItemText = (itemId: string, text: string) => {
    const updated = checklist.map((c) => (c.id === itemId ? { ...c, text } : c));
    updateMeta({ checklist: updated });
  };

  /* ── Comment handlers ───────────────────────────────── */

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
    setNewComment('');
    setMentionQuery(null);
  };

  const mentionableMembers = spaceMembers?.filter((m) => m.user.clerkId !== user?.id) ?? [];

  function getMemberDisplayNameForMention(member: { user: { name: string | null; firstName: string | null; lastName: string | null; email: string } }) {
    const u = member.user;
    return u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  }

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);
    if (!spaceMembers || spaceMembers.length === 0) return;
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) { setMentionQuery(null); return; }
    if (atIndex > 0 && !/\s/.test(textBeforeCursor[atIndex - 1])) { setMentionQuery(null); return; }
    const query = textBeforeCursor.slice(atIndex + 1);
    if (query.includes(' ') || query.includes('\n')) { setMentionQuery(null); return; }
    setMentionQuery(query);
    setMentionStartIndex(atIndex);
    const ta = commentTextareaRef.current;
    if (ta) setDropdownPosition({ top: ta.offsetHeight + 4, left: 0 });
  };

  const handleCommentMentionSelect = (member: (typeof mentionableMembers)[number]) => {
    const displayName = getMemberDisplayNameForMention(member);
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

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionDropdownRef.current) {
      if (mentionDropdownRef.current.handleKeyDown(e)) return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
  };

  const userInitial = user?.firstName?.charAt(0).toUpperCase() ?? user?.username?.charAt(0).toUpperCase() ?? 'U';

  const hasDynamicFields = Object.keys(dynamicFields).length > 0;

  const TABS: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'details', label: 'Details', icon: Info },
    ...(hasDynamicFields ? [{ id: 'formdata' as ModalTab, label: 'Form Data', icon: FileText }] : []),
    { id: 'history', label: 'History', icon: Clock },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
  ];

  /* ── Render ──────────────────────────────────────────── */

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.8)' }}
    >
      <div
        className="relative w-full max-w-[1080px] rounded-xl shadow-2xl shadow-black/50 bg-[#0d0b14] border border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ Header ════════════════════════════════════ */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badge row */}
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-xs font-mono font-semibold text-gray-400 tracking-wide">
                  {task.taskKey}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300">
                  <UserPlus className="h-3 w-3 text-brand-light-pink" />
                  Onboarding
                </span>
                <span className="text-xs text-gray-500">{columnTitle}</span>
                {checklistProgress === 100 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <CheckSquare className="h-3 w-3" />
                    Complete
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="group/title">
                {editingTitle ? (
                  <input
                    ref={titleRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle();
                      if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
                    }}
                    className="w-full text-xl font-semibold text-white bg-transparent border-b border-brand-mid-pink/40 focus-visible:outline-none focus-visible:border-brand-light-pink/60 pb-0.5 transition-colors"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <h2 className="text-xl font-semibold text-white leading-snug">
                      {task.title}
                    </h2>
                    <Pencil className="h-3 w-3 text-gray-700 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>

              {/* Quick stats */}
              {(modelName || platform) && (
                <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-400">
                  {modelName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{modelName}</span>}
                  {platform && <span className="capitalize">{platform}</span>}
                  <span className="text-brand-light-pink font-medium">{completedCount}/{checklist.length} steps</span>
                </div>
              )}
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ═══ Tab Bar ═══════════════════════════════════ */}
        <div className="px-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={[
                  'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === t.id
                    ? 'text-gray-100'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === 'comments' && comments.length > 0 && (
                  <span className="ml-0.5 text-[11px] font-bold text-brand-light-pink">
                    {comments.length}
                  </span>
                )}
                {activeTab === t.id && (
                  <span className="absolute inset-x-1 bottom-0 h-px bg-brand-mid-pink" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Body ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px]">
          {/* ── Left: Tab Content ──────────────────────── */}
          <div className="px-6 py-5 min-h-[50vh] max-h-[62vh] overflow-y-auto custom-scrollbar border-r border-white/[0.04]">

            {/* ── Details Tab ────────────────────────────── */}
            {activeTab === 'details' && (
              <>
                {/* Model Information */}
                <Section icon={User} title="Model Information">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <SideLabel>Model Name</SideLabel>
                      <EditableField
                        value={modelName}
                        placeholder="Enter model name"
                        onSave={(v) => updateMeta({ modelName: v })}
                      />
                    </div>
                    <div>
                      <SideLabel>Platform</SideLabel>
                      <SelectField
                        value={platform || 'Select...'}
                        options={PLATFORM_OPTIONS}
                        onSave={(v) => updateMeta({ platform: v })}
                      />
                    </div>
                    <div>
                      <SideLabel>Assignee</SideLabel>
                      <SearchableDropdown
                        value={getMemberName(task.assignee) ?? ''}
                        placeholder="Unassigned"
                        searchPlaceholder="Search members..."
                        options={(spaceMembers ?? []).map((m) => m.user.name || `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email)}
                        onChange={(v) => {
                          if (!v) { onUpdate({ ...task, assignee: undefined }); }
                          else {
                            const member = spaceMembers?.find((m) => (m.user.name || `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email) === v);
                            if (member) onUpdate({ ...task, assignee: member.user.clerkId });
                          }
                        }}
                        clearable
                      />
                    </div>
                    <div>
                      <SideLabel>Launching Date (PST)</SideLabel>
                      <EditableField
                        value={task.dueDate ?? ''}
                        type="datetime-local"
                        placeholder="Not set"
                        displaySuffix="PST"
                        onSave={(v) => onUpdate({ ...task, dueDate: v })}
                      />
                    </div>
                  </div>
                  {/* Social handles */}
                  <div className="mt-3">
                    <SideLabel>Social Handles</SideLabel>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {socialHandles.map((h) => (
                        <RemovableTag key={h} variant="pink" onRemove={() => removeFromArray('socialHandles', h)}>
                          {h}
                        </RemovableTag>
                      ))}
                    </div>
                    <TagInput
                      value={getTagInput('socialHandles')}
                      onChange={(v) => setTagInput('socialHandles', v)}
                      onAdd={() => addToArray('socialHandles', getTagInput('socialHandles'))}
                      placeholder="@handle"
                    />
                  </div>
                </Section>

                {/* Onboarding Checklist */}
                <Section
                  icon={ClipboardList}
                  title="Onboarding Checklist"
                  badge={
                    <span className={`text-xs font-mono font-bold ${checklistProgress === 100 ? 'text-emerald-400' : 'text-brand-light-pink'}`}>
                      {completedCount}/{checklist.length}
                    </span>
                  }
                >
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-gray-500">Progress</span>
                      <span className={`text-xs font-bold ${checklistProgress === 100 ? 'text-emerald-400' : 'text-brand-light-pink'}`}>
                        {checklistProgress}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${checklistProgress === 100 ? 'bg-emerald-500' : 'bg-brand-light-pink'}`}
                        style={{ width: `${checklistProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist items with drag-and-drop. */}
                  <DragDropContext onDragEnd={handleChecklistDragEnd}>
                    <Droppable droppableId="checklist">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                          {checklist.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(dp, ds) => (
                                <div
                                  ref={dp.innerRef}
                                  {...dp.draggableProps}
                                  className={[
                                    'flex items-center gap-2 rounded-lg px-2 py-2 group/check transition-colors',
                                    ds.isDragging ? 'bg-white/[0.06] shadow-lg' : 'hover:bg-white/[0.02]',
                                  ].join(' ')}
                                >
                                  <span {...dp.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-500 shrink-0">
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleChecklistItem(item.id)}
                                    className={`shrink-0 h-4.5 w-4.5 rounded border-2 flex items-center justify-center transition-colors ${
                                      item.completed
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-gray-600 hover:border-brand-light-pink'
                                    }`}
                                  >
                                    {item.completed && <CheckSquare className="h-3 w-3" />}
                                  </button>
                                  <ChecklistItemText
                                    item={item}
                                    onSave={(text) => updateChecklistItemText(item.id, text)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeChecklistItem(item.id)}
                                    className="shrink-0 p-0.5 opacity-0 group-hover/check:opacity-100 text-gray-700 hover:text-red-400 transition-all"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {/* Add new step */}
                  <div className="flex items-center gap-1.5 mt-3">
                    <input
                      value={newStepText}
                      onChange={(e) => setNewStepText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                      placeholder="Add a step..."
                      className="flex-1 rounded px-2 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 bg-white/[0.03] border border-white/[0.06] focus-visible:outline-none focus-visible:border-brand-mid-pink/30"
                    />
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="p-1 rounded text-gray-500 hover:text-brand-light-pink transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Section>

                {/* Notes */}
                <Section icon={Pencil} title="Notes">
                  <div className="group/notes">
                    {editingNotes ? (
                      <div>
                        <textarea
                          ref={notesRef}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg px-3 py-2 text-[13px] text-gray-200 placeholder:text-gray-600 bg-white/[0.02] border border-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-mid-pink/30 resize-none"
                          placeholder="Add notes..."
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <button type="button" onClick={saveNotes} className="px-3 py-1 rounded-lg text-xs font-semibold text-brand-light-pink border border-brand-light-pink/20 hover:bg-brand-light-pink/[0.06] transition-colors">
                            Save
                          </button>
                          <button type="button" onClick={() => { setNotesDraft(notes); setEditingNotes(false); }} className="px-3 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEditingNotes(true)} className="flex items-start gap-2 w-full text-left">
                        <p className="text-[13px] text-gray-400 whitespace-pre-wrap flex-1 leading-relaxed">
                          {notes || <span className="text-gray-600 italic">Click to add notes...</span>}
                        </p>
                        <Pencil className="h-3 w-3 text-gray-700 opacity-0 group-hover/notes:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </button>
                    )}
                  </div>
                </Section>

                {/* Tags */}
                <Section icon={Tag} title="Tags">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {tags.map((t) => (
                      <RemovableTag key={t} onRemove={() => removeFromArray('tags', t)}>
                        {t}
                      </RemovableTag>
                    ))}
                  </div>
                  <TagInput
                    value={getTagInput('tags')}
                    onChange={(v) => setTagInput('tags', v)}
                    onAdd={() => addToArray('tags', getTagInput('tags'))}
                    placeholder="Add tag..."
                  />
                </Section>

                {/* Timestamps */}
                <Section icon={Clock} title="Timestamps (PST)" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {typeof meta._createdAt === 'string' && (
                      <div><SideLabel>Created</SideLabel><span className="text-gray-400">{formatFullDate(meta._createdAt as string)}</span></div>
                    )}
                    {typeof meta._updatedAt === 'string' && (
                      <div><SideLabel>Updated</SideLabel><span className="text-gray-400">{formatFullDate(meta._updatedAt as string)}</span></div>
                    )}
                  </div>
                </Section>

                {/* Activity Feed */}
                <Section icon={MessageSquare} title="Activity">
                  <ActivityFeed
                    comments={comments}
                    history={historyEntries}
                    onAddComment={(content) => addCommentMutation.mutate(content)}
                    currentUserName={user?.firstName ?? user?.username ?? 'You'}
                    currentUserClerkId={user?.id}
                    members={spaceMembers ?? undefined}
                    isLoading={commentsLoading || historyLoading}
                  />
                </Section>
              </>
            )}

            {/* ── Form Data Tab ─────────────────────────── */}
            {activeTab === 'formdata' && (
              <div className="space-y-3">
                {fieldOrder.map((key) => (
                  <div key={key} className="py-2 border-b border-white/[0.04] last:border-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 mb-1">
                      {key}
                    </div>
                    <p className="text-[13px] text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                      {dynamicFields[key] || <span className="text-gray-600 italic">—</span>}
                    </p>
                  </div>
                ))}
                {fieldOrder.length === 0 && (
                  <EmptyState icon={FileText} text="No form data available." />
                )}
              </div>
            )}

            {/* ── History Tab ────────────────────────────── */}
            {activeTab === 'history' && (
              <div>
                {historyLoading ? <ActivitySkeleton /> : historyEntries.length === 0 ? <EmptyState icon={Clock} text="No history yet." /> : (
                  historyEntries.map((h, idx) => {
                    const isCreated = h.action === 'CREATED';
                    const fieldLabel = formatFieldName(h.field);
                    const initial = h.changedBy?.charAt(0)?.toUpperCase();
                    return (
                      <div
                        key={h.id}
                        className="flex items-start gap-3 py-2.5"
                        style={{ borderBottom: idx !== historyEntries.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                      >
                        <span className={`shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${isCreated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-gray-500'}`}>
                          {initial || (isCreated ? <Plus className="h-3 w-3" /> : <History className="h-3 w-3" />)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-gray-300 leading-relaxed">
                            <span className="font-medium text-gray-200">{h.changedBy}</span>{' '}
                            {isCreated ? 'created this item' : (
                              <>changed <span className="text-gray-300">{fieldLabel}</span>{h.oldValue && <> from <span className="line-through text-gray-600">{h.oldValue}</span></>} to <span className="text-brand-light-pink">{h.newValue}</span></>
                            )}
                          </p>
                          <span className="text-[11px] text-gray-500">{formatDate(h.changedAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Comments Tab ───────────────────────────── */}
            {activeTab === 'comments' && (
              <div>
                <div className="flex items-start gap-2.5 mb-5">
                  <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue text-[11px] font-bold mt-0.5">
                    {userInitial}
                  </span>
                  <div className="flex-1 relative">
                    <textarea
                      ref={commentTextareaRef}
                      value={newComment}
                      onChange={handleCommentChange}
                      onKeyDown={handleCommentKeyDown}
                      rows={2}
                      placeholder="Add a comment... Use @ to mention"
                      className="w-full rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 bg-white/[0.02] border border-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-mid-pink/30 resize-none"
                    />
                    {mentionQuery !== null && (
                      <MentionDropdown
                        ref={mentionDropdownRef}
                        members={mentionableMembers}
                        query={mentionQuery}
                        position={dropdownPosition}
                        onSelect={handleCommentMentionSelect}
                        onClose={() => setMentionQuery(null)}
                        excludeClerkIds={alreadyMentionedIds}
                      />
                    )}
                    {newComment.trim() && (
                      <button type="button" onClick={handleAddComment} className="mt-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-brand-light-pink border border-brand-light-pink/20 hover:bg-brand-light-pink/[0.06] transition-colors">
                        Post
                      </button>
                    )}
                  </div>
                </div>

                {commentsLoading ? <ActivitySkeleton /> : comments.length === 0 ? <EmptyState icon={MessageSquare} text="No comments yet." /> : (
                  comments.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2.5 py-2.5"
                      style={{ borderBottom: idx !== comments.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                    >
                      <span className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${getAvatarColor(c.author)}`}>
                        {c.author.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-medium text-gray-100">{c.author}</span>
                          <span className="text-[11px] text-gray-500">{formatDate(c.createdAt)}</span>
                        </div>
                        <p className="text-[13px] text-gray-300 leading-relaxed"><CommentContent content={c.content} /></p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ═══ Right Sidebar ═══════════════════════════ */}
          <div className="px-4 py-4 max-h-[62vh] overflow-y-auto custom-scrollbar">
            <SideRow label="Status">
              <span className="text-xs text-gray-200">{columnTitle}</span>
            </SideRow>

            <SideRow label="Assignee">
              <span className="text-xs text-gray-200">{getMemberName(task.assignee) ?? 'Unassigned'}</span>
            </SideRow>

            <SideRow label="Model Name">
              <EditableField value={modelName} placeholder="Model name" onSave={(v) => updateMeta({ modelName: v })} />
            </SideRow>

            <SideRow label="Platform">
              <SelectField
                value={platform || 'Select...'}
                options={PLATFORM_OPTIONS}
                onSave={(v) => updateMeta({ platform: v })}
              />
            </SideRow>

            <SideRow label="Progress">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${checklistProgress === 100 ? 'text-emerald-400' : 'text-brand-light-pink'}`}>
                    {checklistProgress}%
                  </span>
                  <span className="text-[11px] text-gray-500">{completedCount}/{checklist.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${checklistProgress === 100 ? 'bg-emerald-500' : 'bg-brand-light-pink'}`}
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>
            </SideRow>

            <SideRow label="Launching Date (PST)">
              <EditableField value={task.dueDate ?? ''} type="datetime-local" placeholder="Not set" displaySuffix="PST" onSave={(v) => onUpdate({ ...task, dueDate: v })} />
            </SideRow>

            {socialHandles.length > 0 && (
              <SideRow label="Social">
                <div className="flex flex-wrap gap-1">
                  {socialHandles.map((h) => <span key={h} className="text-xs text-brand-light-pink">{h}</span>)}
                </div>
              </SideRow>
            )}

            {tags.length > 0 && (
              <SideRow label="Tags">
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => <span key={t} className="text-xs text-brand-blue">{t}</span>)}
                </div>
              </SideRow>
            )}

            {meta.source === 'webhook' && (
              <SideRow label="Source">
                <span className="inline-flex items-center gap-1 text-xs text-brand-blue">
                  <FileText className="h-3 w-3" />
                  Webhook
                </span>
              </SideRow>
            )}

            {Object.keys(dynamicFields).length > 0 && (
              <SideRow label="Form Fields">
                <span className="text-xs text-gray-400">{Object.keys(dynamicFields).length} fields</span>
              </SideRow>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Inline editable checklist item text ─────────────────── */

function ChecklistItemText({
  item,
  onSave,
}: {
  item: ChecklistItem;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(item.text); }, [item.text]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.text) onSave(trimmed);
    else setDraft(item.text);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setDraft(item.text); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-w-0 bg-transparent border-b border-brand-mid-pink/30 text-[13px] text-gray-200 focus-visible:outline-none focus-visible:border-brand-light-pink/60 px-0 py-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`flex-1 min-w-0 text-left text-[13px] transition-colors ${
        item.completed ? 'text-gray-600 line-through' : 'text-gray-300'
      }`}
    >
      {item.text}
      {item.completedAt && (
        <span className="ml-2 text-[10px] text-gray-700">
          {new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}
        </span>
      )}
    </button>
  );
}
