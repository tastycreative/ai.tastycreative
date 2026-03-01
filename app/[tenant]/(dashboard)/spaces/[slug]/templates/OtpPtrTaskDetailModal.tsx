'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  DollarSign,
  User,
  CalendarDays,
  Package,
  ShieldCheck,
  ClipboardList,
  FileText,
  Tag,
  ChevronUp,
  History,
  MessageSquare,
  Plus,
  Layers,
  CreditCard,
  Layout,
  Info,
  Clock,
  ExternalLink,
  Film,
  Hash,
  Users,
  Link2,
  type LucideIcon,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import {
  useBoardItemComments,
  useAddComment,
  useBoardItemHistory,
} from '@/lib/hooks/useBoardItems.query';

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

type ModalTab = 'details' | 'history' | 'comments';

/* ── Constants ───────────────────────────────────────────── */

const REQUEST_TYPE_OPTIONS = ['OTP', 'PTR', 'CUSTOM'];
const CONTENT_STYLE_OPTIONS = ['NORMAL', 'PPV', 'GAME', 'POLL', 'BUNDLE'];

const PRIORITY_PILL: Record<string, string> = {
  High: 'border-red-500/40 text-red-400 bg-red-500/8',
  Medium: 'border-amber-500/40 text-amber-400 bg-amber-500/8',
  Low: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/8',
};

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

function formatPricingLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const COMMENT_AVATAR_COLORS = [
  'bg-brand-light-pink/15 text-brand-light-pink',
  'bg-brand-blue/15 text-brand-blue',
  'bg-emerald-500/15 text-emerald-400',
  'bg-violet-500/15 text-violet-400',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COMMENT_AVATAR_COLORS[Math.abs(hash) % COMMENT_AVATAR_COLORS.length];
}

/* ── GlowCard — card with gradient left border ───────────── */

function GlowCard({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
  badge,
  iconColorClass,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  iconColorClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const iconClasses = iconColorClass ?? 'bg-brand-light-pink/10 text-brand-light-pink';

  return (
    <div className="relative mb-4 rounded-xl overflow-hidden group/glow">
      {/* Gradient left border */}
      <div
        className="absolute inset-y-0 left-0 w-[3px] transition-opacity"
        style={{
          background:
            'linear-gradient(180deg, #F774B9 0%, #a855f7 50%, #5DC3F8 100%)',
          opacity: open ? 0.7 : 0.3,
        }}
      />

      <div
        className="ml-[3px] rounded-r-xl backdrop-blur-sm transition-colors"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderLeft: 'none',
        }}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center w-full px-5 py-3.5 gap-3 text-left"
        >
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${iconClasses}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13px] font-semibold text-brand-off-white tracking-wide flex-1">
            {title}
          </span>
          {badge}
          <ChevronUp
            className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
              open ? '' : 'rotate-180'
            }`}
          />
        </button>

        {/* Body */}
        <div
          className="grid transition-all duration-200"
          style={{
            gridTemplateRows: open ? '1fr' : '0fr',
          }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-4 pt-0">
              <div
                className="pt-3.5"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tag Chip ────────────────────────────────────────────── */

function TagChip({
  children,
  color = 'blue',
}: {
  children: React.ReactNode;
  color?: 'blue' | 'pink' | 'amber' | 'gray' | 'emerald';
}) {
  const colors = {
    blue: 'bg-brand-blue/10 text-brand-blue border-brand-blue/15',
    pink: 'bg-brand-light-pink/10 text-brand-light-pink border-brand-light-pink/15',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/15',
    gray: 'bg-white/[0.06] text-gray-300 border-white/[0.06]',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border ${colors[color]}`}
    >
      {children}
    </span>
  );
}

/* ── Sidebar Field ───────────────────────────────────────── */

function SidebarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ── Sidebar Section Header ──────────────────────────────── */

function SidebarSectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-1.5 first:pt-0">
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-600">
        {label}
      </span>
      <div className="mt-1.5 border-t border-white/[0.06]" />
    </div>
  );
}

/* ── Sidebar Divider ─────────────────────────────────────── */

function SidebarDivider() {
  return <div className="border-t border-white/[0.04]" />;
}

/* ── Skeleton Loader ─────────────────────────────────────── */

function ActivitySkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 animate-pulse py-3">
          <div className="shrink-0 h-8 w-8 rounded-full bg-white/[0.06]" />
          <div className="flex-1 min-w-0 space-y-2 py-1">
            <div className="flex items-center gap-2">
              <div className="h-3 w-20 bg-white/[0.06] rounded" />
              <div className="h-2.5 w-14 bg-white/[0.04] rounded" />
            </div>
            <div className="h-3 w-3/4 bg-white/[0.06] rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

/* ── Empty State ─────────────────────────────────────────── */

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-12 w-12 rounded-full bg-white/[0.04] flex items-center justify-center">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  Main Modal                                                */
/* ══════════════════════════════════════════════════════════ */

export function OtpPtrTaskDetailModal({
  task,
  columnTitle,
  isOpen,
  onClose,
  onUpdate,
}: Props) {
  const params = useParams<{ slug: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;

  const [activeTab, setActiveTab] = useState<ModalTab>('details');
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [newComment, setNewComment] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  /* ── Metadata ────────────────────────────────────────── */

  const meta = task.metadata ?? {};
  const requestType = (meta.requestType as string) ?? 'OTP';
  const contentStyle = (meta.contentStyle as string) ?? 'NORMAL';
  const price = (meta.price as number) ?? 0;
  const buyer = (meta.buyer as string) ?? '';
  const model = (meta.model as string) ?? '';
  const deliverables = Array.isArray(meta.deliverables)
    ? (meta.deliverables as string[])
    : [];
  const deadline = (meta.deadline as string) ?? '';
  const isPaid = (meta.isPaid as boolean) ?? false;
  const fulfillmentNotes = (meta.fulfillmentNotes as string) ?? '';
  const pricingCategory = (meta.pricingCategory as string) ?? '';
  const pricingTier = (meta.pricingTier as string) ?? '';
  const pageType = (meta.pageType as string) ?? '';
  const contentType = (meta.contentType as string) ?? '';
  const driveLink = (meta.driveLink as string) ?? '';
  const contentLength = (meta.contentLength as string) ?? '';
  const contentCount = (meta.contentCount as string) ?? '';
  const externalCreatorTags = Array.isArray(meta.externalCreatorTags)
    ? (meta.externalCreatorTags as string[])
    : [];
  const internalModelTags = Array.isArray(meta.internalModelTags)
    ? (meta.internalModelTags as string[])
    : [];
  const contentTags = Array.isArray(meta.contentTags)
    ? (meta.contentTags as string[])
    : [];

  const tier = pricingCategory || pricingTier;

  const [notesDraft, setNotesDraft] = useState(fulfillmentNotes);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  /* ── API hooks ───────────────────────────────────────── */

  const { data: commentsData, isLoading: commentsLoading } =
    useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(
    spaceId ?? '',
    boardId ?? '',
    task.id,
  );
  const { data: historyData, isLoading: historyLoading } =
    useBoardItemHistory(spaceId, boardId, task.id);

  const comments = useMemo(() => {
    if (!commentsData?.comments) return [];
    const currentUserId = user?.id;
    return commentsData.comments.map((c) => ({
      id: c.id,
      author:
        c.createdBy === currentUserId
          ? (user?.firstName ?? user?.username ?? 'You')
          : c.author,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }, [commentsData, user]);

  const historyEntries = useMemo(() => {
    if (!historyData?.history) return [];
    const currentUserId = user?.id;
    return historyData.history.map((h) => ({
      id: h.id,
      action: h.action,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy:
        h.userId === currentUserId
          ? (user?.firstName ?? user?.username ?? 'You')
          : h.userName,
      changedAt: h.createdAt,
    }));
  }, [historyData, user]);

  /* ── Effects ─────────────────────────────────────────── */

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setTitleDraft(task.title);
    setNotesDraft(fulfillmentNotes);
  }, [task, fulfillmentNotes]);
  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);
  useEffect(() => {
    if (editingNotes) notesRef.current?.focus();
  }, [editingNotes]);

  if (!mounted || !isOpen) return null;

  /* ── Helpers ─────────────────────────────────────────── */

  const updateMeta = (partial: Record<string, unknown>) =>
    onUpdate({ ...task, metadata: { ...meta, ...partial } });

  const saveTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== task.title)
      onUpdate({ ...task, title: titleDraft.trim() });
    else setTitleDraft(task.title);
  };

  const saveNotes = () => {
    setEditingNotes(false);
    if (notesDraft !== fulfillmentNotes)
      updateMeta({ fulfillmentNotes: notesDraft });
  };

  const getTagInput = (key: string) => tagInputs[key] ?? '';
  const setTagInput = (key: string, value: string) =>
    setTagInputs((prev) => ({ ...prev, [key]: value }));

  const addToArray = (field: string, value: string) => {
    const arr = Array.isArray(meta[field])
      ? [...(meta[field] as string[])]
      : [];
    const trimmed = value.trim();
    if (trimmed && !arr.includes(trimmed)) {
      updateMeta({ [field]: [...arr, trimmed] });
    }
    setTagInput(field, '');
  };

  const removeFromArray = (field: string, value: string) => {
    const arr = Array.isArray(meta[field])
      ? (meta[field] as string[]).filter((v) => v !== value)
      : [];
    updateMeta({ [field]: arr });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
    setNewComment('');
  };

  const userInitial =
    user?.firstName?.charAt(0).toUpperCase() ??
    user?.username?.charAt(0).toUpperCase() ??
    'U';

  const TABS: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
  ];

  /* ── Render ──────────────────────────────────────────── */

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto py-6 px-3"
      onClick={onClose}
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, rgba(93,195,248,0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(247,116,185,0.05) 0%, transparent 50%), rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="relative w-full max-w-[1120px] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            'linear-gradient(160deg, rgba(18,14,30,0.98) 0%, rgba(14,11,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Top glow line */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 10%, rgba(247,116,185,0.25) 35%, rgba(168,85,247,0.2) 50%, rgba(93,195,248,0.25) 65%, transparent 90%)',
          }}
        />

        {/* ═══ Header ════════════════════════════════════ */}
        <div className="relative px-6 sm:px-8 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badge row */}
              <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
                  Task
                </span>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide text-brand-blue"
                  style={{
                    background: 'rgba(93,195,248,0.08)',
                    border: '1px solid rgba(93,195,248,0.12)',
                  }}
                >
                  {task.taskKey}
                </span>
                <span
                  className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-medium text-gray-400"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {columnTitle}
                </span>
              </div>

              {/* Editable Title */}
              <div className="group/title">
                {editingTitle ? (
                  <input
                    ref={titleRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle();
                      if (e.key === 'Escape') {
                        setTitleDraft(task.title);
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full text-xl sm:text-[22px] font-bold text-brand-off-white bg-transparent border-b-2 border-brand-light-pink/40 focus-visible:outline-none focus-visible:border-brand-light-pink/70 pb-1 transition-colors"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="flex items-center gap-2.5 w-full text-left"
                  >
                    <h2 className="text-xl sm:text-[22px] font-bold text-brand-off-white leading-tight">
                      {task.title}
                    </h2>
                    <Pencil className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>

              {/* Quick-info bar */}
              {(buyer || model || deadline || price > 0) && (
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                  {buyer && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-500" />
                      {buyer}
                    </span>
                  )}
                  {buyer && model && <span className="text-gray-700">|</span>}
                  {model && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-gray-500" />
                      {model}
                    </span>
                  )}
                  {(buyer || model) && deadline && <span className="text-gray-700">|</span>}
                  {deadline && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-gray-500" />
                      {new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {(buyer || model || deadline) && price > 0 && <span className="text-gray-700">|</span>}
                  {price > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-400 font-medium">{price}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Edit + Close buttons */}
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #E1518E 0%, #EC67A1 100%)',
                  boxShadow: '0 2px 12px rgba(225,81,142,0.25)',
                }}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-white transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Tab Bar ═══════════════════════════════════ */}
        <div
          className="px-6 sm:px-8"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={[
                  'relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors',
                  activeTab === t.id
                    ? 'text-brand-off-white'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === 'comments' && comments.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-brand-light-pink/15 text-brand-light-pink text-[9px] font-bold px-1">
                    {comments.length}
                  </span>
                )}
                {activeTab === t.id && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #E1518E, #F774B9)',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Body: Tabs + Sidebar ═════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
          {/* ── Left: Tab Content ──────────────────────── */}
          <div
            className="px-6 sm:px-8 py-6 min-h-[50vh] max-h-[62vh] overflow-y-auto custom-scrollbar"
            style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}
          >
            {/* ── Details Tab ────────────────────────────── */}
            {activeTab === 'details' && (
              <>
                {/* Basic Information */}
                <GlowCard icon={Info} title="Basic Information" iconColorClass="bg-brand-blue/10 text-brand-blue">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        Priority
                      </span>
                      <SelectField
                        value={task.priority ?? 'Medium'}
                        options={['Low', 'Medium', 'High']}
                        onSave={(v) =>
                          onUpdate({
                            ...task,
                            priority: v as BoardTask['priority'],
                          })
                        }
                        renderOption={(v) => (
                          <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_PILL[v] ?? ''}`}>
                            {v}
                          </span>
                        )}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        Assignee
                      </span>
                      <EditableField
                        value={model}
                        placeholder="Unassigned"
                        onSave={(v) => updateMeta({ model: v })}
                      />
                    </div>
                  </div>
                </GlowCard>

                {/* Description */}
                <GlowCard icon={FileText} title="Description" iconColorClass="bg-brand-light-pink/10 text-brand-light-pink">
                  <div className="space-y-4">
                    <EditableField
                      value={task.description ?? ''}
                      placeholder="Additional details..."
                      onSave={(v) =>
                        onUpdate({ ...task, description: v || undefined })
                      }
                    />

                    {/* Content details sub-grid */}
                    <div
                      className="pt-3 mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-0.5">
                          Content Type
                        </span>
                        <EditableField
                          value={contentType}
                          placeholder="Set content type"
                          onSave={(v) => updateMeta({ contentType: v })}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-0.5">
                          Length
                        </span>
                        <EditableField
                          value={contentLength}
                          placeholder="Set length"
                          onSave={(v) => updateMeta({ contentLength: v })}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-0.5">
                          Count
                        </span>
                        <EditableField
                          value={contentCount}
                          placeholder="Set count"
                          onSave={(v) => updateMeta({ contentCount: v })}
                        />
                      </div>
                    </div>

                    {/* Pricing row */}
                    {price > 0 ? (
                      <div
                        className="mt-1 pt-3"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 shrink-0">
                            <DollarSign className="h-4 w-4 text-emerald-400" />
                          </span>
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-500/70 block">
                              Price
                            </span>
                            <span className="text-lg font-bold text-emerald-400">${price}</span>
                          </div>
                          <div className="flex-1" />
                          <EditableField
                            value={String(price)}
                            placeholder="0.00"
                            onSave={(v) =>
                              updateMeta({ price: Number(v) || 0 })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-between pt-3"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                          Price
                        </span>
                        <EditableField
                          value=""
                          placeholder="0.00"
                          onSave={(v) =>
                            updateMeta({ price: Number(v) || 0 })
                          }
                        />
                      </div>
                    )}
                  </div>
                </GlowCard>

                {/* Drive Link */}
                <GlowCard icon={Link2} title="Google Drive" iconColorClass="bg-amber-400/10 text-amber-400">
                  <div className="space-y-2">
                    <EditableField
                      value={driveLink}
                      placeholder="Paste Google Drive link..."
                      onSave={(v) => updateMeta({ driveLink: v })}
                    />
                    {driveLink && (
                      <a
                        href={driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-brand-blue hover:text-brand-blue/80 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="underline underline-offset-2">
                          Open in Drive
                        </span>
                      </a>
                    )}
                  </div>
                </GlowCard>

                {/* Fulfillment Notes */}
                <GlowCard icon={ClipboardList} title="Fulfillment Notes" iconColorClass="bg-emerald-400/10 text-emerald-400">
                  <div className="group/notes">
                    {editingNotes ? (
                      <div>
                        <textarea
                          ref={notesRef}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          rows={5}
                          placeholder="Delivery instructions, special requests..."
                          className="w-full rounded-lg border border-brand-light-pink/25 bg-white/[0.03] px-3.5 py-2.5 text-sm text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/30 resize-none transition-shadow"
                        />
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={saveNotes}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
                            style={{
                              background:
                                'linear-gradient(135deg, #E1518E, #EC67A1)',
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNotesDraft(fulfillmentNotes);
                              setEditingNotes(false);
                            }}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingNotes(true)}
                        className="flex items-start gap-2 w-full text-left"
                      >
                        <p className="text-sm text-gray-300 whitespace-pre-wrap flex-1 leading-relaxed">
                          {fulfillmentNotes || (
                            <span className="text-gray-600 italic">
                              Click to add fulfillment notes...
                            </span>
                          )}
                        </p>
                        <Pencil className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover/notes:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </button>
                    )}
                  </div>
                </GlowCard>

                {/* Deliverables */}
                <GlowCard
                  icon={Package}
                  title="Deliverables"
                  iconColorClass="bg-violet-400/10 text-violet-400"
                  badge={
                    deliverables.length > 0 ? (
                      <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-brand-blue/15 text-brand-blue text-[10px] font-bold px-1.5">
                        {deliverables.length}
                      </span>
                    ) : undefined
                  }
                >
                  {deliverables.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {deliverables.map((d, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 group/del"
                          style={{
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Package className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                          <span className="text-sm text-gray-300 flex-1">
                            {d}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromArray('deliverables', d);
                            }}
                            className="opacity-0 group-hover/del:opacity-100 p-0.5 rounded text-gray-500 hover:text-red-400 transition-all"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {deliverables.length === 0 && (
                    <p className="text-xs text-gray-600 italic py-1 mb-3">
                      No deliverables specified
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      value={getTagInput('deliverables')}
                      onChange={(e) =>
                        setTagInput('deliverables', e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray(
                            'deliverables',
                            getTagInput('deliverables'),
                          );
                        }
                      }}
                      placeholder="Add deliverable..."
                      className="flex-1 rounded-lg px-3 py-1.5 text-xs text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-light-pink/30"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        addToArray(
                          'deliverables',
                          getTagInput('deliverables'),
                        )
                      }
                      className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-brand-light-pink hover:bg-brand-light-pink/10 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </GlowCard>

                {/* Tags */}
                <GlowCard icon={Tag} title="Tags" iconColorClass="bg-sky-400/10 text-sky-400">
                  <div className="space-y-4">
                    {/* External Creators */}
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        External Creators
                      </span>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {externalCreatorTags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-light-pink/10 text-brand-light-pink border-brand-light-pink/15 group/tag"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() =>
                                removeFromArray('externalCreatorTags', t)
                              }
                              className="opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={getTagInput('externalCreatorTags')}
                          onChange={(e) =>
                            setTagInput(
                              'externalCreatorTags',
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addToArray(
                                'externalCreatorTags',
                                getTagInput('externalCreatorTags'),
                              );
                            }
                          }}
                          placeholder="Add creator tag..."
                          className="flex-1 rounded-lg px-2.5 py-1 text-[11px] text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-light-pink/30"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addToArray(
                              'externalCreatorTags',
                              getTagInput('externalCreatorTags'),
                            )
                          }
                          className="p-1 rounded text-gray-400 hover:text-brand-light-pink transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Internal Models */}
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        Internal Models
                      </span>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {internalModelTags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() =>
                                removeFromArray('internalModelTags', t)
                              }
                              className="opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={getTagInput('internalModelTags')}
                          onChange={(e) =>
                            setTagInput(
                              'internalModelTags',
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addToArray(
                                'internalModelTags',
                                getTagInput('internalModelTags'),
                              );
                            }
                          }}
                          placeholder="Add model tag..."
                          className="flex-1 rounded-lg px-2.5 py-1 text-[11px] text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-light-pink/30"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addToArray(
                              'internalModelTags',
                              getTagInput('internalModelTags'),
                            )
                          }
                          className="p-1 rounded text-gray-400 hover:text-brand-light-pink transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Content Tags */}
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        Content Tags
                      </span>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {contentTags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-white/[0.06] text-gray-300 border-white/[0.06]"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() =>
                                removeFromArray('contentTags', t)
                              }
                              className="opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={getTagInput('contentTags')}
                          onChange={(e) =>
                            setTagInput('contentTags', e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addToArray(
                                'contentTags',
                                getTagInput('contentTags'),
                              );
                            }
                          }}
                          placeholder="Add content tag..."
                          className="flex-1 rounded-lg px-2.5 py-1 text-[11px] text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-light-pink/30"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addToArray(
                              'contentTags',
                              getTagInput('contentTags'),
                            )
                          }
                          className="p-1 rounded text-gray-400 hover:text-brand-light-pink transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </GlowCard>

                {/* Metadata — created/updated timestamps */}
                <GlowCard icon={Clock} title="Metadata" defaultOpen={false} iconColorClass="bg-gray-400/10 text-gray-400">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {typeof meta.createdAt === 'string' && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1">
                          Created
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-300">
                            {formatFullDate(meta.createdAt)}
                          </span>
                        </div>
                      </div>
                    )}
                    {typeof meta.updatedAt === 'string' && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1">
                          Last Updated
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-300">
                            {formatFullDate(meta.updatedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </GlowCard>
              </>
            )}

            {/* ── History Tab ────────────────────────────── */}
            {activeTab === 'history' && (
              <div className="space-y-0">
                {historyLoading ? (
                  <ActivitySkeleton />
                ) : historyEntries.length === 0 ? (
                  <EmptyState icon={Clock} text="No history yet." />
                ) : (
                  historyEntries.map((h, idx) => {
                    const isCreated = h.action === 'CREATED';
                    const fieldLabel = formatFieldName(h.field);
                    const initial = h.changedBy?.charAt(0)?.toUpperCase();
                    return (
                      <div
                        key={h.id}
                        className="flex items-start gap-3 py-3"
                        style={{
                          borderBottom:
                            idx !== historyEntries.length - 1
                              ? '1px solid rgba(255,255,255,0.03)'
                              : 'none',
                        }}
                      >
                        {initial ? (
                          <span
                            className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              isCreated
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-brand-blue/15 text-brand-blue'
                            }`}
                          >
                            {initial}
                          </span>
                        ) : (
                          <span
                            className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                              isCreated
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-white/[0.06] text-gray-400'
                            }`}
                          >
                            {isCreated ? <Plus className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                          </span>
                        )}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[13px] text-gray-300 leading-relaxed">
                            <span className="font-semibold text-brand-off-white">
                              {h.changedBy}
                            </span>{' '}
                            {isCreated ? (
                              <>created this item</>
                            ) : (
                              <>
                                changed{' '}
                                <span className="font-medium text-gray-200">
                                  {fieldLabel}
                                </span>{' '}
                                {h.oldValue && (
                                  <>
                                    from{' '}
                                    <span className="line-through text-gray-500">
                                      {h.oldValue}
                                    </span>{' '}
                                  </>
                                )}
                                to{' '}
                                <span className="font-medium text-brand-light-pink">
                                  {h.newValue}
                                </span>
                              </>
                            )}
                          </p>
                          <span className="text-[10px] text-gray-500 mt-0.5 block">
                            {formatDate(h.changedAt)}
                          </span>
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
                {/* Comment input */}
                <div className="flex items-start gap-3 mb-6">
                  <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/15 text-brand-blue text-[11px] font-bold mt-0.5">
                    {userInitial}
                  </span>
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                          handleAddComment();
                      }}
                      rows={3}
                      placeholder="Add a comment... (Cmd+Enter to save)"
                      className="w-full rounded-lg px-3.5 py-2.5 text-sm text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/30 resize-none transition-shadow"
                      style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    />
                    {newComment.trim() && (
                      <button
                        type="button"
                        onClick={handleAddComment}
                        className="mt-2 px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:brightness-110"
                        style={{
                          background:
                            'linear-gradient(135deg, #E1518E, #EC67A1)',
                        }}
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>

                {/* Comment list */}
                <div className="space-y-0">
                  {commentsLoading ? (
                    <ActivitySkeleton />
                  ) : comments.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      text="No comments yet. Be the first!"
                    />
                  ) : (
                    comments.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 py-3"
                        style={{
                          borderBottom:
                            idx !== comments.length - 1
                              ? '1px solid rgba(255,255,255,0.03)'
                              : 'none',
                        }}
                      >
                        <span className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${getAvatarColor(c.author)}`}>
                          {c.author.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-semibold text-brand-off-white">
                              {c.author}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {formatDate(c.createdAt)}
                            </span>
                          </div>
                          <p className="text-[13px] text-gray-300 leading-relaxed">
                            {c.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ═══ Right Sidebar (persistent) ═══════════════ */}
          <div className="px-5 py-5 max-h-[62vh] overflow-y-auto custom-scrollbar space-y-0">
            {/* ── Status & Payment ── */}
            <SidebarSectionHeader label="Status & Payment" />

            <SidebarField label="Status">
              <span
                className="inline-flex items-center rounded-md text-brand-off-white px-2.5 py-1 text-xs font-medium"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {columnTitle}
              </span>
            </SidebarField>

            {/* Type & Style — side by side */}
            <div className="grid grid-cols-2 gap-3 py-2.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                  Type
                </div>
                <SelectField
                  value={requestType}
                  options={REQUEST_TYPE_OPTIONS}
                  onSave={(v) => updateMeta({ requestType: v })}
                  renderOption={(v) => (
                    <span className="flex items-center gap-2 text-sm text-brand-off-white">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          v === 'OTP'
                            ? 'bg-brand-blue'
                            : v === 'PTR'
                              ? 'bg-brand-light-pink'
                              : 'bg-amber-500'
                        }`}
                      />
                      {v}
                    </span>
                  )}
                />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-1.5">
                  Style
                </div>
                <SelectField
                  value={contentStyle}
                  options={CONTENT_STYLE_OPTIONS}
                  onSave={(v) => updateMeta({ contentStyle: v })}
                />
              </div>
            </div>

            {/* Payment — enhanced badge */}
            <SidebarField label="Payment Status">
              <button
                type="button"
                onClick={() => updateMeta({ isPaid: !isPaid })}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors border ${
                  isPaid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">{isPaid ? 'Paid' : 'Unpaid'}</span>
                <span
                  className={`h-2 w-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-red-500'}`}
                />
              </button>
            </SidebarField>

            {/* ── Classification ── */}
            <SidebarSectionHeader label="Classification" />

            <SidebarField label="Tier">
              <EditableField
                value={tier}
                placeholder="Set tier"
                onSave={(v) =>
                  updateMeta({ pricingCategory: v, pricingTier: v })
                }
              />
            </SidebarField>

            <SidebarField label="Page Type">
              <EditableField
                value={pageType}
                placeholder="Set page type"
                onSave={(v) => updateMeta({ pageType: v })}
              />
            </SidebarField>

            <SidebarField label="Content Type">
              <EditableField
                value={contentType}
                placeholder="Set type"
                onSave={(v) => updateMeta({ contentType: v })}
              />
            </SidebarField>

            {/* ── People & Pricing ── */}
            <SidebarSectionHeader label="People & Pricing" />

            <SidebarField label="Model">
              <EditableField
                value={model}
                placeholder="Model name"
                onSave={(v) => updateMeta({ model: v })}
              />
            </SidebarField>

            <SidebarField label="Buyer">
              <EditableField
                value={buyer}
                placeholder="@username"
                onSave={(v) => updateMeta({ buyer: v })}
              />
            </SidebarField>

            <SidebarField label="Price">
              <EditableField
                value={price ? String(price) : ''}
                placeholder="0.00"
                onSave={(v) => updateMeta({ price: Number(v) || 0 })}
              />
            </SidebarField>

            {/* ── Schedule & Delivery ── */}
            <SidebarSectionHeader label="Schedule & Delivery" />

            <SidebarField label="Deadline">
              <EditableField
                value={deadline}
                type="date"
                placeholder="Not set"
                onSave={(v) => updateMeta({ deadline: v })}
              />
            </SidebarField>

            <SidebarField label="Deliverables">
              {deliverables.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {deliverables.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() =>
                          removeFromArray('deliverables', d)
                        }
                        className="opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-600 italic">None</span>
              )}
            </SidebarField>

            {/* Tags summary in sidebar */}
            {(externalCreatorTags.length > 0 || internalModelTags.length > 0) && (
              <>
                <SidebarDivider />
                <SidebarField label="Tagged People">
                  <div className="flex flex-wrap gap-1">
                    {externalCreatorTags.map((t) => (
                      <span
                        key={`ext-${t}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-light-pink/10 text-brand-light-pink border-brand-light-pink/15"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() =>
                            removeFromArray('externalCreatorTags', t)
                          }
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    {internalModelTags.map((t) => (
                      <span
                        key={`int-${t}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() =>
                            removeFromArray('internalModelTags', t)
                          }
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </SidebarField>
              </>
            )}

            {/* Drive link in sidebar */}
            <SidebarDivider />
            <SidebarField label="Drive Link">
              <EditableField
                value={driveLink}
                placeholder="Paste link..."
                onSave={(v) => updateMeta({ driveLink: v })}
              />
              {driveLink && (
                <a
                  href={driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] text-brand-blue hover:text-brand-blue/80 transition-colors mt-1"
                >
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  <span className="underline underline-offset-2">
                    Open
                  </span>
                </a>
              )}
            </SidebarField>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
