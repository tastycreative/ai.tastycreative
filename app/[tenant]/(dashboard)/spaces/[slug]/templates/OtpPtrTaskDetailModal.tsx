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
  ClipboardList,
  FileText,
  Tag,
  History,
  MessageSquare,
  Plus,
  CreditCard,
  Info,
  Clock,
  ExternalLink,
  Film,
  Users,
  Link2,
  ChevronDown,
  Image as ImageIcon,
  Settings,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
// Note: All icons above are used across the component's sections and sidebar
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
import { useOrgRole } from '@/lib/hooks/useOrgRole.query';
import {
  useBoardItemComments,
  useAddComment,
  useBoardItemHistory,
  useBoardItemMedia,
} from '@/lib/hooks/useBoardItems.query';
import {
  useOtpPtrQAAction,
} from '@/lib/hooks/useCaptionQueue.query';
import {
  OTP_PTR_CAPTION_STATUS,
  OTP_PTR_STATUS_CONFIG,
  type OtpPtrCaptionStatus,
} from '@/lib/otp-ptr-caption-status';

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

type ModalTab = 'details' | 'workflow' | 'history' | 'comments';

/* ── Constants ───────────────────────────────────────────── */

const REQUEST_TYPE_OPTIONS = ['OTP', 'PTR', 'CUSTOM'];
const CONTENT_STYLE_OPTIONS = ['NORMAL', 'PPV', 'GAME', 'POLL', 'BUNDLE'];

const PRIORITY_PILL: Record<string, string> = {
  High: 'text-red-400',
  Medium: 'text-amber-400',
  Low: 'text-emerald-400',
};

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-400',
  Medium: 'bg-amber-400',
  Low: 'bg-emerald-400',
};

const TYPE_DOT: Record<string, string> = {
  OTP: 'bg-brand-blue',
  PTR: 'bg-brand-light-pink',
  CUSTOM: 'bg-amber-400',
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
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center w-full gap-2.5 py-2.5 px-1 text-left group/section hover:bg-white/[0.02] rounded-lg transition-colors"
      >
        <Icon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span className="text-[11px] font-semibold text-gray-400 tracking-[0.08em] flex-1 uppercase">
          {title}
        </span>
        {badge}
        <ChevronDown
          className={`h-3 w-3 text-gray-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-3 pl-6 pr-1">
          {children}
        </div>
      )}
      <div className="border-t border-white/[0.04] mx-1" />
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
        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 bg-white/[0.03] border border-white/[0.06] focus-visible:outline-none focus-visible:border-brand-mid-pink/30 transition-colors"
      />
      <button
        type="button"
        onClick={onAdd}
        className="p-1.5 rounded-lg text-gray-500 hover:text-brand-light-pink hover:bg-white/[0.04] transition-all"
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
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${colors[variant]}`}>
      {children}
      <button type="button" onClick={onRemove} className="opacity-50 hover:opacity-100 transition-opacity">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
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
  const { data: orgMembers = [] } = useOrgMembers();
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
  const [editingCaption, setEditingCaption] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<MentionDropdownHandle>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const alreadyMentionedIds = useMemo(() => extractMentionedClerkIds(newComment), [newComment]);

  /* ── Metadata ────────────────────────────────────────── */

  const meta = task.metadata ?? {};
  const requestType = (meta.requestType as string) ?? 'OTP';
  const contentStyle = (meta.contentStyle as string) ?? 'NORMAL';
  const price = (meta.price as number) ?? 0;
  const buyer = (meta.buyer as string) ?? '';
  const model = (meta.model as string) ?? '';
  const deliverables = Array.isArray(meta.deliverables) ? (meta.deliverables as string[]) : [];
  const deadline = (meta.deadline as string) ?? '';
  const isPaid = (meta.isPaid as boolean) ?? false;
  const fulfillmentNotes = (meta.fulfillmentNotes as string) ?? '';
  const pricingCategory = (meta.pricingCategory as string) ?? '';
  const pricingTier = (meta.pricingTier as string) ?? '';
  const pageType = (meta.pageType as string) ?? '';
  const contentType = (meta.contentType as string) ?? '';
  const rawDriveLink = (meta.driveLink as string) ?? '';
  const driveLink = rawDriveLink && !rawDriveLink.startsWith('http') ? `https://${rawDriveLink}` : rawDriveLink;
  const contentLength = (meta.contentLength as string) ?? '';
  const contentCount = (meta.contentCount as string) ?? '';
  const externalCreatorTags = Array.isArray(meta.externalCreatorTags) ? (meta.externalCreatorTags as string[]) : [];
  const internalModelTags = Array.isArray(meta.internalModelTags) ? (meta.internalModelTags as string[]) : [];
  const contentTags = Array.isArray(meta.contentTags) ? (meta.contentTags as string[]) : [];
  const platforms = Array.isArray(meta.platforms) ? (meta.platforms as string[]) : [];
  const caption = (meta.caption as string) ?? '';
  const gameType = (meta.gameType as string) ?? '';
  const gifUrl = (meta.gifUrl as string) ?? '';
  const gameNotes = (meta.gameNotes as string) ?? '';
  const originalPollReference = (meta.originalPollReference as string) ?? '';

  const captionTicketId = (meta.captionTicketId as string) ?? null;
  const otpPtrCaptionStatus: OtpPtrCaptionStatus = (meta.otpPtrCaptionStatus as OtpPtrCaptionStatus) ?? OTP_PTR_CAPTION_STATUS.PENDING_CAPTION;
  const workspaceCaptionText = (meta.captionText as string) ?? '';
  const tier = pricingCategory || pricingTier;

  const [notesDraft, setNotesDraft] = useState(fulfillmentNotes);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  /* ── API hooks ───────────────────────────────────────── */

  const { canManageQueue } = useOrgRole();
  const otpPtrQAMutation = useOtpPtrQAAction();
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: commentsData, isLoading: commentsLoading } =
    useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(spaceId ?? '', boardId ?? '', task.id);
  const { data: historyData, isLoading: historyLoading } =
    useBoardItemHistory(spaceId, boardId, task.id);
  const { data: mediaData = [] } = useBoardItemMedia(
    spaceId, boardId, task.id, isOpen,
  );

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
    setNotesDraft(fulfillmentNotes);
    setCaptionDraft(caption);
  }, [task, fulfillmentNotes, caption]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingNotes) notesRef.current?.focus(); }, [editingNotes]);
  useEffect(() => { if (editingCaption) captionRef.current?.focus(); }, [editingCaption]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingTitle && !editingNotes && !editingCaption) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingTitle, editingNotes, editingCaption, onClose]);

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
    if (notesDraft !== fulfillmentNotes) updateMeta({ fulfillmentNotes: notesDraft });
  };

  const saveCaption = () => {
    setEditingCaption(false);
    if (captionDraft !== caption) updateMeta({ caption: captionDraft });
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

  const TABS: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'workflow', label: 'Workflow', icon: Workflow },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'comments', label: 'Comments', icon: MessageSquare },
  ];

  const captionCfg = OTP_PTR_STATUS_CONFIG[otpPtrCaptionStatus as OtpPtrCaptionStatus] ?? OTP_PTR_STATUS_CONFIG[OTP_PTR_CAPTION_STATUS.PENDING_CAPTION];

  /* ── Render ──────────────────────────────────────────── */

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl shadow-2xl shadow-black/60 bg-[#0f1729]/95 backdrop-blur-xl border border-white/[0.08] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pink gradient top strip */}
        <div className="h-[3px] w-full bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

        {/* ═══ Header ════════════════════════════════════ */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badge row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-mono text-[11px] font-semibold text-gray-300 bg-white/[0.05] px-2.5 py-1 rounded-full border border-white/[0.08] tracking-wide">
                  {task.taskKey}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${
                  requestType === 'OTP'
                    ? 'bg-brand-blue/15 text-brand-blue'
                    : requestType === 'PTR'
                    ? 'bg-brand-light-pink/15 text-brand-light-pink'
                    : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {requestType}
                </span>
                <span className="text-[11px] text-gray-500 bg-white/[0.04] px-2.5 py-1 rounded-full">
                  {columnTitle}
                </span>
                {/* Caption status */}
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 bg-white/[0.04] ${captionCfg.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${captionCfg.dotColor}`} />
                  {captionCfg.label}
                </span>
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
                    className="w-full text-[22px] font-bold text-white bg-transparent border-b border-brand-mid-pink/40 focus-visible:outline-none focus-visible:border-brand-light-pink/60 pb-0.5 transition-colors tracking-tight"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <h2 className="text-[22px] font-bold text-white leading-snug tracking-tight">
                      {task.title}
                    </h2>
                    <Pencil className="h-3 w-3 text-gray-700 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>

              {/* Quick info bar */}
              {(buyer || model || deadline || price > 0 || platforms.length > 0) && (
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 rounded-xl bg-[#1a2237]/80 border border-white/[0.06] px-4 py-2.5">
                  {price > 0 && (
                    <span className="text-brand-light-pink font-bold text-sm">${price}</span>
                  )}
                  {(meta.isPaid as boolean) != null && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      (meta.isPaid as boolean)
                        ? 'bg-emerald-500/12 text-emerald-400'
                        : 'bg-red-500/12 text-red-400'
                    }`}>
                      {(meta.isPaid as boolean) ? 'PAID' : 'UNPAID'}
                    </span>
                  )}
                  {model && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-300">{model}</span>
                    </span>
                  )}
                  {platforms.length > 0 && platforms.map((p) => (
                    <span key={p} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p === 'onlyfans'
                        ? 'bg-brand-blue/12 text-brand-blue'
                        : 'bg-brand-light-pink/12 text-brand-light-pink'
                    }`}>
                      {p === 'onlyfans' ? 'OF' : 'Fansly'}
                    </span>
                  ))}
                  {deadline && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-gray-500" />
                      <span className="text-gray-300">{new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Top-right actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs font-semibold text-white bg-brand-light-pink/90 hover:bg-brand-light-pink transition-all duration-200"
              >
                <Pencil className="h-3 w-3" />
                Edit Task
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ Tab Bar ═══════════════════════════════════ */}
        <div className="px-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={[
                  'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all duration-200',
                  activeTab === t.id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                <t.icon className={`h-3.5 w-3.5 ${activeTab === t.id ? 'text-brand-light-pink' : ''}`} />
                {t.label}
                {t.id === 'comments' && comments.length > 0 && (
                  <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 ${activeTab === t.id ? 'bg-brand-light-pink/15 text-brand-light-pink' : 'bg-white/[0.06] text-gray-400'}`}>
                    {comments.length}
                  </span>
                )}
                {/* Active indicator */}
                {activeTab === t.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-light-pink rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Body ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          {/* ── Left: Tab Content ──────────────────────── */}
          <div className="px-6 py-5 min-h-[50vh] max-h-[62vh] overflow-y-auto custom-scrollbar border-r border-white/[0.04]">

            {/* ── Details Tab ────────────────────────────── */}
            {activeTab === 'details' && (
              <>
                {/* Basic Information */}
                <Section icon={Info} title="Basic Information">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <SideLabel>Priority</SideLabel>
                      <SelectField
                        value={task.priority ?? 'Medium'}
                        options={['Low', 'Medium', 'High']}
                        onSave={(v) => onUpdate({ ...task, priority: v as BoardTask['priority'] })}
                        renderOption={(v) => (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${PRIORITY_PILL[v] ?? 'text-gray-300'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[v] ?? ''}`} />
                            {v}
                          </span>
                        )}
                      />
                    </div>
                    <div>
                      <SideLabel>Assignee</SideLabel>
                      <SearchableDropdown
                        value={getMemberName(task.assignee) ?? ''}
                        placeholder="Unassigned"
                        searchPlaceholder="Search members..."
                        options={orgMembers.map((m) => getMemberName(m.clerkId) ?? m.email)}
                        onChange={(v) => {
                          if (!v) { onUpdate({ ...task, assignee: undefined }); }
                          else {
                            const member = orgMembers.find((m) => (getMemberName(m.clerkId) ?? m.email) === v);
                            if (member) onUpdate({ ...task, assignee: member.clerkId });
                          }
                        }}
                        clearable
                      />
                    </div>
                  </div>
                </Section>

                {/* Description & Content */}
                <Section icon={FileText} title="Description & Content">
                  <div className="space-y-3">
                    <EditableField value={task.description ?? ''} placeholder="Add description..." onSave={(v) => onUpdate({ ...task, description: v || undefined })} />

                    <div className="grid grid-cols-3 gap-x-4 gap-y-2 pt-2 border-t border-white/[0.04]">
                      <div><SideLabel>Content Type</SideLabel><EditableField value={contentType} placeholder="Set type" onSave={(v) => updateMeta({ contentType: v })} /></div>
                      <div><SideLabel>Length</SideLabel><EditableField value={contentLength} placeholder="Set length" onSave={(v) => updateMeta({ contentLength: v })} /></div>
                      <div><SideLabel>Count</SideLabel><EditableField value={contentCount} placeholder="Set count" onSave={(v) => updateMeta({ contentCount: v })} /></div>
                    </div>

                    {/* Platforms */}
                    <div className="pt-2 border-t border-white/[0.04]">
                      <SideLabel>Platforms</SideLabel>
                      <div className="flex items-center gap-2 mt-1">
                        {(['onlyfans', 'fansly'] as const).map((p) => {
                          const isActive = platforms.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                const next = isActive
                                  ? platforms.filter((x) => x !== p)
                                  : [...platforms, p];
                                if (next.length === 0) return;
                                updateMeta({ platforms: next });
                              }}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-all duration-200 ${
                                isActive
                                  ? p === 'onlyfans'
                                    ? 'bg-brand-blue/15 border-brand-blue/30 text-brand-blue'
                                    : 'bg-brand-light-pink/15 border-brand-light-pink/30 text-brand-light-pink'
                                  : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:border-white/[0.12]'
                              }`}
                            >
                              {p === 'onlyfans' ? 'OnlyFans' : 'Fansly'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
                      <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium text-gray-400">Price</span>
                      <span className="flex-1" />
                      <EditableField value={price ? String(price) : ''} placeholder="0.00" onSave={(v) => updateMeta({ price: Number(v) || 0 })} />
                    </div>
                  </div>
                </Section>

                {/* Drive Link */}
                <Section icon={Link2} title="Google Drive">
                  <EditableField value={rawDriveLink} placeholder="Paste Drive link..." onSave={(v) => updateMeta({ driveLink: v })} />
                  {driveLink && (
                    <a href={driveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:underline mt-1.5">
                      <ExternalLink className="h-3 w-3" />Open in Drive
                    </a>
                  )}
                </Section>

                {/* Notes */}
                <Section icon={ClipboardList} title="Notes">
                  <div className="group/notes">
                    {editingNotes ? (
                      <div>
                        <textarea
                          ref={notesRef}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          rows={4}
                          placeholder="Delivery instructions, special requests..."
                          className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-mid-pink/30 resize-none"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button type="button" onClick={saveNotes} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-light-pink/80 hover:bg-brand-light-pink transition-colors">
                            Save
                          </button>
                          <button type="button" onClick={() => { setNotesDraft(fulfillmentNotes); setEditingNotes(false); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEditingNotes(true)} className="flex items-start gap-2 w-full text-left">
                        <p className="text-[13px] text-gray-400 whitespace-pre-wrap flex-1 leading-relaxed">
                          {fulfillmentNotes || <span className="text-gray-600 italic">Click to add notes...</span>}
                        </p>
                        <Pencil className="h-3 w-3 text-gray-700 opacity-0 group-hover/notes:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </button>
                    )}
                  </div>
                </Section>

                {/* Tags */}
                <Section icon={Tag} title="Tags">
                  <div className="space-y-3">
                    <div>
                      <SideLabel>External Creators</SideLabel>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {externalCreatorTags.map((t) => <RemovableTag key={t} variant="pink" onRemove={() => removeFromArray('externalCreatorTags', t)}>{t}</RemovableTag>)}
                      </div>
                      <TagInput value={getTagInput('externalCreatorTags')} onChange={(v) => setTagInput('externalCreatorTags', v)} onAdd={() => addToArray('externalCreatorTags', getTagInput('externalCreatorTags'))} placeholder="Add creator..." />
                    </div>
                    <div>
                      <SideLabel>Internal Models</SideLabel>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {internalModelTags.map((t) => <RemovableTag key={t} variant="blue" onRemove={() => removeFromArray('internalModelTags', t)}>{t}</RemovableTag>)}
                      </div>
                      <TagInput value={getTagInput('internalModelTags')} onChange={(v) => setTagInput('internalModelTags', v)} onAdd={() => addToArray('internalModelTags', getTagInput('internalModelTags'))} placeholder="Add model..." />
                    </div>
                    <div>
                      <SideLabel>Content Tags</SideLabel>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {contentTags.map((t) => <RemovableTag key={t} onRemove={() => removeFromArray('contentTags', t)}>{t}</RemovableTag>)}
                      </div>
                      <TagInput value={getTagInput('contentTags')} onChange={(v) => setTagInput('contentTags', v)} onAdd={() => addToArray('contentTags', getTagInput('contentTags'))} placeholder="Add tag..." />
                    </div>
                  </div>
                </Section>

                {/* Timestamps */}
                <Section icon={Clock} title="Timestamps" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {typeof meta.createdAt === 'string' && (
                      <div><SideLabel>Created</SideLabel><span className="text-gray-400">{formatFullDate(meta.createdAt)}</span></div>
                    )}
                    {typeof meta.updatedAt === 'string' && (
                      <div><SideLabel>Updated</SideLabel><span className="text-gray-400">{formatFullDate(meta.updatedAt)}</span></div>
                    )}
                  </div>
                </Section>
              </>
            )}

            {/* ── Workflow Tab ─────────────────────────────── */}
            {activeTab === 'workflow' && (
              <>
                {/* PGT Team */}
                <Section icon={FileText} title="PGT Team">
                  <div className="space-y-3">
                    {/* Caption Status */}
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium ${captionCfg.bgColor} ${captionCfg.color}`}>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${captionCfg.dotColor}`} />
                      {captionCfg.label}
                      {captionTicketId && <span className="ml-auto text-[10px] opacity-50">Ticket linked</span>}
                    </div>

                    {driveLink && (
                      <div>
                        <SideLabel>Drive Content</SideLabel>
                        <a href={driveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue/80 transition-colors">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="underline underline-offset-2 break-all">{driveLink.length > 55 ? driveLink.slice(0, 52) + '...' : driveLink}</span>
                        </a>
                      </div>
                    )}

                    <div>
                      <SideLabel>Caption</SideLabel>
                      {workspaceCaptionText ? (
                        <p className="text-[13px] text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                          {workspaceCaptionText}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600 italic">
                          {otpPtrCaptionStatus === OTP_PTR_CAPTION_STATUS.PENDING_CAPTION
                            ? 'Not yet pushed to Caption Workspace.'
                            : otpPtrCaptionStatus === OTP_PTR_CAPTION_STATUS.IN_CAPTION
                            ? 'Captioner is working on it...'
                            : 'No caption written yet.'}
                        </p>
                      )}
                    </div>

                    {otpPtrCaptionStatus === OTP_PTR_CAPTION_STATUS.NEEDS_REVISION && (meta.qaRejectionReason as string) && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/6 border border-red-500/15 text-xs">
                        <span className="text-red-400 shrink-0 mt-0.5 font-bold">!</span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase text-red-400 mb-0.5">Rejection reason</p>
                          <p className="text-red-300/80 whitespace-pre-wrap">{meta.qaRejectionReason as string}</p>
                        </div>
                      </div>
                    )}

                    {/* QA actions */}
                    {canManageQueue && otpPtrCaptionStatus === OTP_PTR_CAPTION_STATUS.AWAITING_APPROVAL && captionTicketId && (
                      <div className="space-y-2">
                        {showRejectInput ? (
                          <div className="space-y-2">
                            <textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              rows={2}
                              placeholder="Reason for rejection (optional)..."
                              className="w-full rounded-lg border border-red-500/20 bg-white/[0.02] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={otpPtrQAMutation.isPending}
                                onClick={async () => {
                                  await otpPtrQAMutation.mutateAsync({ ticketId: captionTicketId, action: 'reject', reason: rejectReason.trim() || undefined });
                                  setShowRejectInput(false);
                                  setRejectReason('');
                                  onUpdate({ ...task, metadata: { ...meta, otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.NEEDS_REVISION } });
                                }}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500/70 hover:bg-red-500/90 transition-colors disabled:opacity-40"
                              >
                                {otpPtrQAMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                              </button>
                              <button type="button" onClick={() => { setShowRejectInput(false); setRejectReason(''); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={otpPtrQAMutation.isPending}
                              onClick={async () => {
                                await otpPtrQAMutation.mutateAsync({ ticketId: captionTicketId, action: 'approve' });
                                onUpdate({ ...task, metadata: { ...meta, otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.APPROVED } });
                              }}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] transition-colors disabled:opacity-40"
                            >
                              {otpPtrQAMutation.isPending ? 'Processing...' : 'Approve'}
                            </button>
                            <button type="button" onClick={() => setShowRejectInput(true)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/25 hover:bg-red-500/[0.06] transition-colors">
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {otpPtrCaptionStatus === OTP_PTR_CAPTION_STATUS.APPROVED && canManageQueue && (
                      confirmRevoke ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-amber-400 flex-1">Revoke approval?</span>
                          <button className="px-2 py-1 rounded text-gray-400 hover:text-gray-200 transition-colors" onClick={() => setConfirmRevoke(false)}>Cancel</button>
                          <button
                            className="px-2 py-1 rounded text-amber-400 border border-amber-500/25 hover:bg-amber-500/10 font-semibold transition-colors disabled:opacity-40"
                            disabled={otpPtrQAMutation.isPending}
                            onClick={async () => {
                              if (!captionTicketId) return;
                              await otpPtrQAMutation.mutateAsync({ ticketId: captionTicketId, action: 'revoke_approval' });
                              onUpdate({ ...task, metadata: { ...meta, otpPtrCaptionStatus: OTP_PTR_CAPTION_STATUS.AWAITING_APPROVAL, captionStatus: 'pending_qa', qaRejectionReason: null } });
                              setConfirmRevoke(false);
                            }}
                          >
                            {otpPtrQAMutation.isPending ? 'Revoking...' : 'Confirm'}
                          </button>
                        </div>
                      ) : (
                        <button className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors" onClick={() => setConfirmRevoke(true)}>
                          Revoke Approval
                        </button>
                      )
                    )}
                  </div>
                </Section>

                {/* Flyer Team */}
                <Section icon={Film} title="Flyer Team">
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <div>
                      <SideLabel>Game Type</SideLabel>
                      <EditableField value={gameType} placeholder="Wheel, Dice..." onSave={(v) => updateMeta({ gameType: v })} />
                    </div>
                    <div>
                      <SideLabel>GIF URL</SideLabel>
                      <EditableField value={gifUrl} placeholder="https://..." onSave={(v) => updateMeta({ gifUrl: v })} />
                      {gifUrl && (
                        <a href={gifUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline mt-0.5 inline-block">Open</a>
                      )}
                    </div>
                    <div>
                      <SideLabel>Game Notes</SideLabel>
                      <EditableField value={gameNotes} placeholder="Notes..." onSave={(v) => updateMeta({ gameNotes: v })} />
                    </div>
                  </div>
                </Section>

                {/* PPV/Bundle Details */}
                {(contentStyle.toLowerCase() === 'ppv' || contentStyle.toLowerCase() === 'bundle') && (
                  <Section icon={Film} title="PPV/Bundle Details">
                    <SideLabel>Original Poll Reference</SideLabel>
                    <EditableField value={originalPollReference} placeholder="Reference..." onSave={(v) => updateMeta({ originalPollReference: v })} />
                  </Section>
                )}

                {/* Attachments / Media */}
                {mediaData.length > 0 && (
                  <Section icon={ImageIcon} title={`Attachments (${mediaData.length})`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mediaData.map((m) => {
                        const isVideo = m.type?.startsWith('video/');
                        return (
                          <a
                            key={m.id}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative aspect-square rounded-lg overflow-hidden bg-black/20 border border-white/[0.06] hover:border-brand-light-pink/30 transition-all duration-200"
                          >
                            {isVideo ? (
                              <video
                                src={m.url}
                                className="h-full w-full object-cover"
                                muted
                                preload="metadata"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Deliverables */}
                <Section
                  icon={Package}
                  title="Deliverables"
                  badge={deliverables.length > 0 ? <span className="text-xs font-mono text-gray-500">{deliverables.length}</span> : undefined}
                >
                  {deliverables.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {deliverables.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-[13px] text-gray-300 group/del">
                          <span className="h-1 w-1 rounded-full bg-brand-blue shrink-0" />
                          <span className="flex-1">{d}</span>
                          <button type="button" onClick={() => removeFromArray('deliverables', d)} className="opacity-0 group-hover/del:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {deliverables.length === 0 && <p className="text-xs text-gray-600 italic mb-2">None</p>}
                  <TagInput value={getTagInput('deliverables')} onChange={(v) => setTagInput('deliverables', v)} onAdd={() => addToArray('deliverables', getTagInput('deliverables'))} placeholder="Add deliverable..." />
                </Section>
              </>
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
                      <button type="button" onClick={handleAddComment} className="mt-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-light-pink/80 hover:bg-brand-light-pink transition-colors">
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

          {/* ═══ Right Sidebar — Properties ═══════════════ */}
          <div className="px-4 py-4 max-h-[62vh] overflow-y-auto custom-scrollbar bg-[#111827]/50">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-3.5 w-3.5 text-gray-500" />
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">Properties</h3>
            </div>

            <SideRow label="Status">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-off-white">
                <span className="h-2 w-2 rounded-full bg-brand-light-pink" />
                {columnTitle}
              </span>
            </SideRow>

            <SideRow label="Priority">
              <SelectField
                value={task.priority ?? 'Medium'}
                options={['Low', 'Medium', 'High']}
                onSave={(v) => onUpdate({ ...task, priority: v as BoardTask['priority'] })}
                renderOption={(v) => (
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${PRIORITY_PILL[v] ?? 'text-gray-300'}`}>
                    <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[v] ?? ''}`} />
                    {v}
                  </span>
                )}
              />
            </SideRow>

            <div className="grid grid-cols-2 gap-2 py-2.5 border-b border-white/[0.04]">
              <div>
                <SideLabel>Type</SideLabel>
                <SelectField
                  value={requestType}
                  options={REQUEST_TYPE_OPTIONS}
                  onSave={(v) => updateMeta({ requestType: v })}
                  renderOption={(v) => (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-off-white">
                      <span className={`h-2 w-2 rounded-full ${TYPE_DOT[v] ?? 'bg-gray-500'}`} />
                      {v}
                    </span>
                  )}
                />
              </div>
              <div>
                <SideLabel>Style</SideLabel>
                <SelectField value={contentStyle} options={CONTENT_STYLE_OPTIONS} onSave={(v) => updateMeta({ contentStyle: v })} />
              </div>
            </div>

            <SideRow label="Payment">
              <button
                type="button"
                onClick={() => updateMeta({ isPaid: !isPaid })}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all duration-200 border ${
                  isPaid
                    ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/[0.12]'
                    : 'bg-red-500/[0.08] border-red-500/20 text-red-400 hover:bg-red-500/[0.12]'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">{isPaid ? 'Paid' : 'Unpaid'}</span>
                <span className={`h-2 w-2 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-red-400'}`} />
              </button>
            </SideRow>

            <SideRow label="Tier">
              <span className="text-sm font-semibold text-brand-off-white">
                <EditableField value={tier} placeholder="Set tier" onSave={(v) => updateMeta({ pricingCategory: v, pricingTier: v })} />
              </span>
            </SideRow>

            <SideRow label="Page Type">
              <span className="text-sm font-semibold text-brand-off-white">
                <EditableField value={pageType} placeholder="Set page type" onSave={(v) => updateMeta({ pageType: v })} />
              </span>
            </SideRow>

            <SideRow label="Model">
              <span className="text-sm font-semibold text-brand-off-white">
                <EditableField value={model} placeholder="Model name" onSave={(v) => updateMeta({ model: v })} />
              </span>
            </SideRow>

            <SideRow label="Buyer">
              <span className="text-sm font-semibold text-brand-off-white">
                <EditableField value={buyer} placeholder="@username" onSave={(v) => updateMeta({ buyer: v })} />
              </span>
            </SideRow>

            <SideRow label="Price">
              <span className="text-sm font-semibold text-brand-light-pink">
                <EditableField value={price ? String(price) : ''} placeholder="0.00" onSave={(v) => updateMeta({ price: Number(v) || 0 })} />
              </span>
            </SideRow>

            <SideRow label="Deadline">
              <span className="text-sm font-semibold text-brand-off-white">
                <EditableField value={deadline} type="date" placeholder="Not set" onSave={(v) => updateMeta({ deadline: v })} />
              </span>
            </SideRow>

            {deliverables.length > 0 && (
              <SideRow label="Deliverables">
                <div className="flex flex-wrap gap-1">
                  {deliverables.map((d) => (
                    <span key={d} className="text-[11px] font-medium text-brand-blue bg-brand-blue/10 rounded-md px-1.5 py-0.5 border border-brand-blue/15">{d}</span>
                  ))}
                </div>
              </SideRow>
            )}

            {(externalCreatorTags.length > 0 || internalModelTags.length > 0) && (
              <SideRow label="People">
                <div className="flex flex-wrap gap-1">
                  {externalCreatorTags.map((t) => <span key={`e-${t}`} className="text-[11px] font-medium text-brand-light-pink bg-brand-light-pink/10 rounded-md px-1.5 py-0.5 border border-brand-light-pink/15">{t}</span>)}
                  {internalModelTags.map((t) => <span key={`i-${t}`} className="text-[11px] font-medium text-brand-blue bg-brand-blue/10 rounded-md px-1.5 py-0.5 border border-brand-blue/15">{t}</span>)}
                </div>
              </SideRow>
            )}

            {driveLink && (
              <SideRow label="Drive">
                <a href={driveLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline break-all">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {driveLink.length > 30 ? driveLink.slice(0, 27) + '...' : driveLink}
                </a>
              </SideRow>
            )}

            {/* Created / Updated footer */}
            {(typeof meta.createdAt === 'string' || typeof meta.updatedAt === 'string') && (
              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                {typeof meta.createdAt === 'string' && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.04] text-[8px] font-bold text-gray-500 shrink-0">
                      {(getMemberName(task.assignee) ?? 'U').charAt(0).toUpperCase()}
                    </span>
                    Created {formatDate(meta.createdAt)}
                  </div>
                )}
                {typeof meta.updatedAt === 'string' && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.04] text-[8px] font-bold text-gray-500 shrink-0">
                      {(getMemberName(task.assignee) ?? 'U').charAt(0).toUpperCase()}
                    </span>
                    Updated {formatDate(meta.updatedAt)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
