'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  Image as ImageIcon,
  CalendarDays,
  User,
  AtSign,
  FileText,
  Clock,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  CheckCircle2,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import {
  ActivityFeed,
  type TaskComment,
  type TaskHistoryEntry,
} from '../../board/ActivityFeed';
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

type ModalTab = 'description' | 'photos';

interface WallPostPhoto {
  id: string;
  url: string;
  status: 'pending_review' | 'ready_to_post' | 'posted' | 'rejected';
  name?: string;
}

/* ── Constants ───────────────────────────────────────────── */

const PLATFORM_OPTIONS = ['onlyfans', 'fansly', 'instagram', 'twitter', 'reddit'];

const SAMPLE_PHOTOS: WallPostPhoto[] = [
  { id: 'sample-1', url: 'https://picsum.photos/seed/wall1/800/600', status: 'pending_review', name: 'Beach sunset shot.jpg' },
  { id: 'sample-2', url: 'https://picsum.photos/seed/wall2/800/600', status: 'ready_to_post', name: 'Studio portrait.jpg' },
  { id: 'sample-3', url: 'https://picsum.photos/seed/wall3/800/600', status: 'posted', name: 'City skyline.jpg' },
  { id: 'sample-4', url: 'https://picsum.photos/seed/wall4/800/600', status: 'rejected', name: 'Blurry outtake.jpg' },
  { id: 'sample-5', url: 'https://picsum.photos/seed/wall5/800/600', status: 'pending_review', name: 'Pool day.jpg' },
  { id: 'sample-6', url: 'https://picsum.photos/seed/wall6/800/600', status: 'ready_to_post', name: 'Mirror selfie.jpg' },
];

const PHOTO_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string; icon: LucideIcon }
> = {
  pending_review: {
    label: 'Pending Review',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotColor: 'bg-amber-500',
    icon: Clock,
  },
  ready_to_post: {
    label: 'Ready to Post',
    color: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
    dotColor: 'bg-brand-blue',
    icon: CheckCircle2,
  },
  posted: {
    label: 'Posted',
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    icon: Send,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotColor: 'bg-red-500',
    icon: XCircle,
  },
};

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
  const iconClasses =
    iconColorClass ?? 'bg-brand-light-pink/10 text-brand-light-pink';

  return (
    <div className="relative mb-4 rounded-xl overflow-hidden group/glow">
      <div
        className="absolute inset-y-0 left-0 w-[3px] transition-opacity"
        style={{
          background:
            'linear-gradient(180deg, #F774B9 0%, #a855f7 50%, #5DC3F8 100%)',
          opacity: open ? 0.7 : 0.3,
        }}
      />
      <div
        className="ml-[3px] rounded-r-xl transition-colors"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderLeft: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center w-full px-5 py-3.5 gap-3 text-left"
        >
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${iconClasses}`}
          >
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
        <div
          className="grid transition-all duration-200"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-4 pt-0">
              <div
                className="pt-3.5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
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

/* ── Sidebar helpers ─────────────────────────────────────── */

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

/* ══════════════════════════════════════════════════════════ */
/*  Main Modal                                                */
/* ══════════════════════════════════════════════════════════ */

export function WallPostTaskDetailModal({
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

  const [activeTab, setActiveTab] = useState<ModalTab>('description');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  /* ── Metadata ────────────────────────────────────────── */

  const meta = task.metadata ?? {};
  const caption = (meta.caption as string) ?? '';
  const platform = (meta.platform as string) ?? '';
  const hashtags = Array.isArray(meta.hashtags)
    ? (meta.hashtags as string[])
    : [];
  const scheduledDate = (meta.scheduledDate as string) ?? '';
  const model = (meta.model as string) ?? '';
  const mediaCount = (meta.mediaCount as number) ?? 0;
  const realPhotos: WallPostPhoto[] = Array.isArray(meta.photos)
    ? (meta.photos as WallPostPhoto[])
    : [];
  const photos: WallPostPhoto[] = realPhotos.length > 0 ? realPhotos : SAMPLE_PHOTOS;

  const [captionDraft, setCaptionDraft] = useState(caption);

  /* ── Photo status counts ───────────────────────────── */

  const statusCounts = useMemo(() => {
    const counts = {
      pending_review: 0,
      ready_to_post: 0,
      posted: 0,
      rejected: 0,
    };
    photos.forEach((p) => {
      if (p.status in counts) counts[p.status]++;
    });
    return counts;
  }, [photos]);

  const selectedPhoto = photos[selectedPhotoIndex] ?? null;

  /* ── API hooks ───────────────────────────────────────── */

  const { data: commentsData, isLoading: commentsLoading } =
    useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(
    spaceId ?? '',
    boardId ?? '',
    task.id,
  );
  const { data: historyData } = useBoardItemHistory(
    spaceId,
    boardId,
    task.id,
  );

  const comments: TaskComment[] = useMemo(() => {
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

  const history: TaskHistoryEntry[] = useMemo(() => {
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

  const handleAddComment = (content: string) => {
    addCommentMutation.mutate(content);
  };

  /* ── Effects ─────────────────────────────────────────── */

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setTitleDraft(task.title);
    setCaptionDraft(caption);
  }, [task, caption]);
  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);
  useEffect(() => {
    if (editingCaption) captionRef.current?.focus();
  }, [editingCaption]);

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

  const saveCaption = () => {
    setEditingCaption(false);
    if (captionDraft !== caption) updateMeta({ caption: captionDraft });
  };

  const switchTab = (tab: ModalTab) => {
    setActiveTab(tab);
    setSidebarOpen(tab === 'description');
  };

  const TABS: { id: ModalTab; label: string; icon: LucideIcon }[] = [
    { id: 'description', label: 'Description', icon: FileText },
    { id: 'photos', label: 'Photos', icon: ImageIcon },
  ];

  /* ── Render ──────────────────────────────────────────── */

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-start justify-center overflow-y-auto py-6 px-3"
      onClick={onClose}
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, rgba(93,195,248,0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(247,116,185,0.05) 0%, transparent 50%), rgba(0,0,0,0.7)',
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
                  Wall Post
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
                {platform && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize text-brand-light-pink"
                    style={{
                      background: 'rgba(247,116,185,0.08)',
                      border: '1px solid rgba(247,116,185,0.12)',
                    }}
                  >
                    <AtSign className="h-3 w-3" />
                    {platform}
                  </span>
                )}
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
              {(model || scheduledDate) && (
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                  {model && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gray-500" />
                      {model}
                    </span>
                  )}
                  {model && scheduledDate && (
                    <span className="text-gray-700">|</span>
                  )}
                  {scheduledDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-gray-500" />
                      {new Date(scheduledDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
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
                onClick={() => switchTab(t.id)}
                className={[
                  'relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors',
                  activeTab === t.id
                    ? 'text-brand-off-white'
                    : 'text-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === 'photos' && photos.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-brand-light-pink/15 text-brand-light-pink text-[9px] font-bold px-1">
                    {photos.length}
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
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto]">
          {/* ── Left: Tab Content ──────────────────────── */}
          <div
            className="relative px-6 sm:px-8 py-6 min-h-[50vh] max-h-[62vh] overflow-y-auto custom-scrollbar"
            style={{ borderRight: '1px solid rgba(255,255,255,0.04)', willChange: 'scroll-position', contain: 'paint' }}
          >
            {/* Sidebar toggle */}
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="absolute top-3 right-3 z-10 h-7 w-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </button>

            {/* ── Description Tab ────────────────────────── */}
            {activeTab === 'description' && (
              <>
                {/* Photo Status Overview */}
                <GlowCard
                  icon={ImageIcon}
                  title="Photo Status Overview"
                  iconColorClass="bg-brand-blue/10 text-brand-blue"
                  badge={
                    photos.length > 0 ? (
                      <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-brand-blue/15 text-brand-blue text-[10px] font-bold px-1.5">
                        {photos.length}
                      </span>
                    ) : undefined
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(
                      Object.entries(PHOTO_STATUS_CONFIG) as [
                        string,
                        (typeof PHOTO_STATUS_CONFIG)[string],
                      ][]
                    ).map(([key, cfg]) => {
                      const count =
                        statusCounts[key as keyof typeof statusCounts] ?? 0;
                      const StatusIcon = cfg.icon;
                      return (
                        <div
                          key={key}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 border ${cfg.color}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-lg font-bold leading-none block">
                              {count}
                            </span>
                            <span className="text-[9px] font-medium uppercase tracking-wider opacity-70 block mt-0.5">
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlowCard>

                {/* Description / Caption */}
                <GlowCard
                  icon={FileText}
                  title="Description"
                  iconColorClass="bg-brand-light-pink/10 text-brand-light-pink"
                >
                  <div className="group/cap">
                    {editingCaption ? (
                      <div>
                        <textarea
                          ref={captionRef}
                          value={captionDraft}
                          onChange={(e) => setCaptionDraft(e.target.value)}
                          rows={6}
                          placeholder="Write your post caption..."
                          className="w-full rounded-lg border border-brand-light-pink/25 bg-white/[0.03] px-3.5 py-2.5 text-sm text-brand-off-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/30 resize-none transition-shadow"
                        />
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={saveCaption}
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
                              setCaptionDraft(caption);
                              setEditingCaption(false);
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
                        onClick={() => setEditingCaption(true)}
                        className="flex items-start gap-2 w-full text-left"
                      >
                        <p className="text-sm text-gray-300 whitespace-pre-wrap flex-1 leading-relaxed">
                          {caption || (
                            <span className="text-gray-600 italic">
                              Click to write a caption...
                            </span>
                          )}
                        </p>
                        <Pencil className="h-3.5 w-3.5 text-gray-600 opacity-0 group-hover/cap:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </button>
                    )}
                  </div>

                  {/* Hashtags inline */}
                  {hashtags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {hashtags.map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                        >
                          #{h}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes / internal description */}
                  {task.description && (
                    <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-1.5">
                        Internal Notes
                      </span>
                      <EditableField
                        value={task.description ?? ''}
                        placeholder="Internal notes..."
                        onSave={(v) =>
                          onUpdate({ ...task, description: v || undefined })
                        }
                      />
                    </div>
                  )}
                </GlowCard>

                {/* Activity Feed */}
                <div className="mt-2">
                  <ActivityFeed
                    comments={comments}
                    history={history}
                    onAddComment={handleAddComment}
                    currentUserName={
                      user?.firstName ?? user?.username ?? 'User'
                    }
                    isLoading={commentsLoading}
                  />
                </div>
              </>
            )}

            {/* ── Photos Tab ─────────────────────────────── */}
            {activeTab === 'photos' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4 items-start">
                    {/* Left column: Main Photo Viewer + Activity */}
                    <div className="min-w-0">
                      <div
                        className="relative rounded-xl overflow-hidden"
                        style={{
                          background: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedPhoto?.url ?? ''}
                          alt={selectedPhoto?.name ?? 'Photo'}
                          className="w-full aspect-[4/3] object-contain bg-black/30"
                        />

                        {/* Photo navigation overlay */}
                        {photos.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPhotoIndex((prev) =>
                                  prev > 0 ? prev - 1 : photos.length - 1,
                                )
                              }
                              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPhotoIndex((prev) =>
                                  prev < photos.length - 1 ? prev + 1 : 0,
                                )
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {/* Status badge on photo */}
                        {selectedPhoto && (
                          <div className="absolute top-3 left-3">
                            {(() => {
                              const cfg =
                                PHOTO_STATUS_CONFIG[selectedPhoto.status];
                              if (!cfg) return null;
                              const StatusIcon = cfg.icon;
                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold border backdrop-blur-sm ${cfg.color}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {cfg.label}
                                </span>
                              );
                            })()}
                          </div>
                        )}

                        {/* Counter */}
                        <div className="absolute bottom-3 right-3">
                          <span
                            className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm"
                            style={{
                              background: 'rgba(0,0,0,0.5)',
                            }}
                          >
                            {selectedPhotoIndex + 1} / {photos.length}
                          </span>
                        </div>
                      </div>

                      {/* Photo name */}
                      {selectedPhoto?.name && (
                        <p className="text-xs text-gray-400 mt-2 px-1">
                          {selectedPhoto.name}
                        </p>
                      )}

                      {/* Activity Feed below main photo viewer */}
                      <div className="mt-6">
                        <ActivityFeed
                          comments={comments}
                          history={history}
                          onAddComment={handleAddComment}
                          currentUserName={
                            user?.firstName ?? user?.username ?? 'User'
                          }
                          isLoading={commentsLoading}
                        />
                      </div>
                    </div>

                    {/* Photo List Sidebar — stretches full height of left column */}
                    <div className="lg:sticky lg:top-0 space-y-2 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '56vh' }}>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 block mb-2">
                        All Photos
                      </span>
                      {photos.map((photo, idx) => {
                        const isActive = idx === selectedPhotoIndex;
                        const cfg = PHOTO_STATUS_CONFIG[photo.status];
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => setSelectedPhotoIndex(idx)}
                            className={`w-full rounded-lg overflow-hidden transition-all ${
                              isActive
                                ? 'ring-2 ring-brand-light-pink/60'
                                : 'ring-1 ring-white/[0.06] hover:ring-white/[0.12]'
                            }`}
                          >
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.url}
                                alt={photo.name ?? `Photo ${idx + 1}`}
                                className="w-full aspect-[16/10] object-cover"
                              />
                              {/* Status dot */}
                              {cfg && (
                                <div className="absolute top-1.5 right-1.5">
                                  <span
                                    className={`block h-2.5 w-2.5 rounded-full border border-black/30 ${cfg.dotColor}`}
                                  />
                                </div>
                              )}
                              {isActive && (
                                <div className="absolute inset-0 bg-brand-light-pink/10" />
                              )}
                            </div>
                            <div
                              className="px-2 py-1.5 text-left"
                              style={{
                                background: isActive
                                  ? 'rgba(247,116,185,0.06)'
                                  : 'rgba(255,255,255,0.025)',
                              }}
                            >
                              <span className="text-[10px] text-gray-400 block truncate">
                                {photo.name ?? `Photo ${idx + 1}`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
            )}
          </div>

          {/* ═══ Right Sidebar (collapsible) ═══════════════ */}
          <div
            className="max-h-[62vh] overflow-hidden transition-[width] duration-200 ease-in-out"
            style={{ width: sidebarOpen ? 260 : 0 }}
          >
            <div
              className="px-5 py-5 h-full overflow-y-auto custom-scrollbar space-y-0"
              style={{ width: 260, willChange: 'scroll-position', contain: 'paint' }}
            >
            {/* ── Status & Platform ── */}
            <SidebarSectionHeader label="Status & Platform" />

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

            <SidebarField label="Platform">
              <SelectField
                value={platform}
                options={PLATFORM_OPTIONS}
                onSave={(v) => updateMeta({ platform: v })}
                renderOption={(v) => (
                  <span className="flex items-center gap-2 text-sm text-brand-off-white capitalize">
                    <AtSign className="h-3 w-3 text-gray-500" />
                    {v}
                  </span>
                )}
              />
            </SidebarField>

            {/* ── Schedule ── */}
            <SidebarSectionHeader label="Schedule" />

            <SidebarField label="Scheduled Date">
              <EditableField
                value={scheduledDate}
                type="date"
                placeholder="Not scheduled"
                onSave={(v) => updateMeta({ scheduledDate: v })}
              />
            </SidebarField>

            {/* ── Details ── */}
            <SidebarSectionHeader label="Details" />

            <SidebarField label="Model">
              <EditableField
                value={model}
                placeholder="Model name"
                onSave={(v) => updateMeta({ model: v })}
              />
            </SidebarField>

            <SidebarField label="Media Count">
              <EditableField
                value={String(mediaCount)}
                placeholder="0"
                onSave={(v) =>
                  updateMeta({ mediaCount: Number(v) || 0 })
                }
              />
            </SidebarField>

            <SidebarField label="Hashtags">
              {hashtags.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {hashtags.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/15"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-600 italic">
                  No hashtags
                </span>
              )}
            </SidebarField>

            {/* ── Notes ── */}
            <SidebarSectionHeader label="Notes" />

            <SidebarField label="Internal Notes">
              <EditableField
                value={task.description ?? ''}
                placeholder="Internal notes..."
                onSave={(v) =>
                  onUpdate({ ...task, description: v || undefined })
                }
              />
            </SidebarField>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
