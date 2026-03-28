'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X,
  Pencil,
  Layers,
  User,
  Image as ImageIcon,
  ShieldCheck,
  Tag,
  Upload,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Undo2,
  ExternalLink,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import { ActivityFeed, type TaskComment, type TaskHistoryEntry } from '../../board/ActivityFeed';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useSpaceMembers } from '@/lib/hooks/useSpaceMembers.query';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown';
import {
  useBoardItemComments,
  useAddComment,
  useBoardItemHistory,
  useBoardItemMedia,
} from '@/lib/hooks/useBoardItems.query';
import {
  useQAItemAction,
  useRepushRejected,
  useMarkItemPosted,
} from '@/lib/hooks/useCaptionQueue.query';
import {
  SEXTING_SET_STATUS,
  SEXTING_SET_STATUS_CONFIG,
  type SextingSetStatus,
} from '@/lib/sexting-set-status';

interface Props {
  task: BoardTask;
  columnTitle: string;
  columns?: { id: string; name: string }[];
  onColumnChange?: (columnId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

const CATEGORY_OPTIONS = ['bedroom', 'outdoor', 'studio', 'selfie', 'cosplay', 'lingerie', 'other'];
const QUALITY_OPTIONS = ['SD', 'HD', '4K'];
const QUALITY_COLORS: Record<string, string> = {
  SD: 'bg-gray-200 text-gray-600',
  HD: 'bg-brand-blue/10 text-brand-blue',
  '4K': 'bg-brand-light-pink/10 text-brand-light-pink',
};

const CAPTION_STATUS_BADGE: Record<string, { label: string; bgClass: string; textClass: string }> = {
  pending: { label: 'Pending', bgClass: 'bg-gray-500/10', textClass: 'text-gray-400' },
  in_progress: { label: 'In Progress', bgClass: 'bg-amber-500/10', textClass: 'text-amber-400' },
  submitted: { label: 'Submitted', bgClass: 'bg-brand-blue/10', textClass: 'text-brand-blue' },
  approved: { label: 'Approved', bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-400' },
  rejected: { label: 'Rejected', bgClass: 'bg-red-500/10', textClass: 'text-red-400' },
  not_required: { label: 'N/A', bgClass: 'bg-gray-500/10', textClass: 'text-gray-400' },
};

interface CaptionItem {
  url?: string;
  fileName?: string | null;
  captionText?: string | null;
  captionStatus?: string | null;
  qaRejectionReason?: string | null;
  contentItemId?: string;
  isPosted?: boolean;
}

interface MediaWithCaption {
  id: string;
  url: string;
  type: string;
  name?: string | null;
  captionText: string | null;
  captionStatus: string | null;
  qaRejectionReason: string | null;
  contentItemId: string | null;
  isPosted: boolean;
  index: number;
}

/**
 * Sexting Sets detail modal — full media gallery with caption/QA workflow.
 */
export function SextingSetsTaskDetailModal({ task, columnTitle, columns, onColumnChange, isOpen, onClose, onUpdate }: Props) {
  const params = useParams<{ slug: string; tenant: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;
  const { data: spaceMembers = [] } = useSpaceMembers(spaceId);

  const getMemberName = (id?: string) => {
    if (!id) return undefined;
    const m = spaceMembers.find((mb) => mb.user.clerkId === id || mb.userId === id);
    if (!m) return undefined;
    return m.user.name || `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email;
  };

  // Fetch media from BoardItemMedia
  const { data: mediaData = [], isLoading: mediaLoading } = useBoardItemMedia(
    spaceId,
    boardId,
    task.id,
    isOpen,
  );

  // Fetch comments and history
  const { data: commentsData, isLoading: commentsLoading } = useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(spaceId ?? '', boardId ?? '', task.id);
  const { data: historyData } = useBoardItemHistory(spaceId, boardId, task.id);

  const comments: TaskComment[] = useMemo(() => {
    if (!commentsData?.comments) return [];
    const currentUserId = user?.id;
    return commentsData.comments.map((c) => ({
      id: c.id,
      author: c.createdBy === currentUserId ? (user?.firstName ?? user?.username ?? 'You') : c.author,
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
      changedBy: h.userId === currentUserId ? (user?.firstName ?? user?.username ?? 'You') : h.userName,
      changedAt: h.createdAt,
    }));
  }, [historyData, user]);

  const handleAddComment = (content: string) => { addCommentMutation.mutate(content); };

  // Caption Workflow hooks
  const qaItemAction = useQAItemAction();
  const repushRejected = useRepushRejected();
  const markPosted = useMarkItemPosted();

  // UI State
  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  // QA inline rejection UI + optimistic state
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, 'approve' | 'reject' | 'revert'>>({});

  // Metadata
  const meta = task.metadata ?? {};
  const category = (meta.category as string) ?? '';
  const setSize = (meta.setSize as number) ?? 0;
  const model = (meta.model as string) ?? '';
  const quality = (meta.quality as string) ?? 'HD';
  const watermarked = (meta.watermarked as boolean) ?? false;
  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  const sextingSetStatus = ((meta.sextingSetStatus as string) ?? '') as SextingSetStatus;
  const captionTicketId = (meta.captionTicketId as string) ?? '';
  const captionItems: CaptionItem[] = Array.isArray(meta.captionItems) ? (meta.captionItems as CaptionItem[]) : [];

  // Join media with caption items
  const mediaWithCaptions: MediaWithCaption[] = useMemo(() => {
    return mediaData.map((m, idx: number) => {
      const match = captionItems.find((ci) => ci.url === m.url) ?? captionItems[idx] ?? null;
      return {
        id: m.id,
        url: m.url,
        type: m.type ?? 'image/jpeg',
        name: m.name,
        captionText: match?.captionText ?? null,
        captionStatus: match?.captionStatus ?? null,
        qaRejectionReason: match?.qaRejectionReason ?? null,
        contentItemId: match?.contentItemId ?? null,
        isPosted: match?.isPosted ?? false,
        index: idx,
      };
    });
  }, [mediaData, captionItems]);

  // Status derived
  const statusConfig = sextingSetStatus ? SEXTING_SET_STATUS_CONFIG[sextingSetStatus] : null;
  const hasRejected = mediaWithCaptions.some((m) => m.captionStatus === 'rejected');

  const updateMeta = useCallback((partial: Record<string, unknown>) => onUpdate({ ...task, metadata: { ...meta, ...partial } }), [onUpdate, task, meta]);

  const handleQAItemAction = useCallback((contentItemId: string, action: 'approve' | 'reject' | 'revert', reason?: string) => {
    if (!captionTicketId) return;
    // Set optimistic pending state so UI updates instantly
    setPendingActions((prev) => ({ ...prev, [contentItemId]: action }));
    // Clear rejection UI if confirming a reject
    if (action === 'reject') {
      setRejectingItemId(null);
      setRejectReason('');
    }
    qaItemAction.mutate(
      { ticketId: captionTicketId, items: [{ contentItemId, action, reason }] },
      {
        onSuccess: (data) => {
          setPendingActions((prev) => { const next = { ...prev }; delete next[contentItemId]; return next; });
          if (data.captionItems) {
            updateMeta({
              captionItems: data.captionItems,
              sextingSetStatus: data.wallPostStatus,
            });
          }
        },
        onError: () => {
          setPendingActions((prev) => { const next = { ...prev }; delete next[contentItemId]; return next; });
        },
      },
    );
  }, [captionTicketId, qaItemAction, updateMeta]);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTitleDraft(task.title); setDescDraft(task.description ?? ''); }, [task]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDesc) descRef.current?.focus(); }, [editingDesc]);
  // Focus rejection textarea when it opens
  useEffect(() => { if (rejectingItemId) rejectReasonRef.current?.focus(); }, [rejectingItemId]);

  if (!mounted || !isOpen) return null;

  const saveTitle = () => { setEditingTitle(false); if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() }); else setTitleDraft(task.title); };
  const saveDesc = () => { setEditingDesc(false); if (descDraft !== (task.description ?? '')) onUpdate({ ...task, description: descDraft }); };

  const qualityStyle = QUALITY_COLORS[quality] ?? 'bg-gray-100 text-gray-500';

  const selectedMedia = mediaWithCaptions[selectedItemIndex] ?? null;

  const handleRepushRejected = () => {
    if (!captionTicketId) return;
    repushRejected.mutate(captionTicketId, {
      onSuccess: (data) => {
        if (data.captionItems) {
          updateMeta({
            captionItems: data.captionItems,
            sextingSetStatus: data.wallPostStatus,
          });
        }
      },
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-3" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────── */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-brand-light-pink/10 text-brand-light-pink px-2 py-0.5 text-[11px] font-bold tracking-wide">{task.taskKey}</span>
              {category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2.5 py-0.5 text-[11px] font-semibold capitalize">
                  <Layers className="h-3 w-3" />{category}
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${qualityStyle}`}>{quality}</span>
              {watermarked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
                  <ShieldCheck className="h-3 w-3" />Watermarked
                </span>
              )}
              {statusConfig && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConfig.bgClass} ${statusConfig.textClass}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {statusConfig.label}
                </span>
              )}
              <span className="inline-flex items-center rounded-lg bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[10px] font-medium">{columnTitle}</span>
            </div>
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

        {/* ── Body ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">

          {/* Left — gallery + caption actions + activity */}
          <div className="px-6 sm:px-8 py-6 border-r-0 lg:border-r border-gray-200 dark:border-brand-mid-pink/15 min-h-[50vh]">

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Description</h3>
              <div className="group/desc">
                {editingDesc ? (
                  <div>
                    <textarea ref={descRef} value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={3} placeholder="Describe this set..."
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

            {/* Caption Action Bar */}
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              {captionTicketId && hasRejected && (
                <button
                  type="button"
                  onClick={handleRepushRejected}
                  disabled={repushRejected.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {repushRejected.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Re-push Rejected
                </button>
              )}
              {captionTicketId && (
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/${params.tenant}/workspace/caption-workspace?ticket=${captionTicketId}`, '_blank');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-blue transition-colors cursor-pointer group/ticket"
                >
                  Ticket: <span className="font-mono text-brand-blue group-hover/ticket:underline">{captionTicketId.slice(-8)}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/ticket:opacity-100 transition-opacity" />
                </button>
              )}
            </div>

            {/* Gallery — large preview + filmstrip */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Gallery</h3>
                <span className="text-[10px] text-gray-400">{mediaWithCaptions.length} image{mediaWithCaptions.length !== 1 ? 's' : ''}</span>
              </div>

              {mediaLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : mediaWithCaptions.length > 0 ? (
                <div>
                  {/* Large preview */}
                  <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-brand-mid-pink/15 mb-3">
                    <div className="aspect-[4/3] relative">
                      {selectedMedia?.type?.startsWith('video/') ? (
                        <video
                          src={selectedMedia.url}
                          className="absolute inset-0 w-full h-full object-contain bg-black"
                          controls
                        />
                      ) : (
                        <img
                          src={selectedMedia?.url ?? ''}
                          alt={selectedMedia?.name ?? ''}
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                      )}
                      {/* Nav arrows */}
                      {mediaWithCaptions.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedItemIndex((prev) => (prev > 0 ? prev - 1 : mediaWithCaptions.length - 1))}
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedItemIndex((prev) => (prev < mediaWithCaptions.length - 1 ? prev + 1 : 0))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                    {/* Caption/Status info for selected item */}
                    {selectedMedia && (
                      <div className="p-3 border-t border-gray-200 dark:border-brand-mid-pink/15 bg-gray-50/50 dark:bg-gray-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-500 truncate mb-1">{selectedMedia.name ?? `Image ${selectedMedia.index + 1}`}</p>
                            {selectedMedia.captionText ? (
                              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{selectedMedia.captionText}</p>
                            ) : (
                              <p className="text-sm text-gray-400 italic">No caption yet</p>
                            )}
                            {selectedMedia.qaRejectionReason && (
                              <p className="mt-1 text-xs text-red-400">Rejection: {selectedMedia.qaRejectionReason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {selectedMedia.captionStatus && CAPTION_STATUS_BADGE[selectedMedia.captionStatus] && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CAPTION_STATUS_BADGE[selectedMedia.captionStatus].bgClass} ${CAPTION_STATUS_BADGE[selectedMedia.captionStatus].textClass}`}>
                                {CAPTION_STATUS_BADGE[selectedMedia.captionStatus].label}
                              </span>
                            )}
                            {selectedMedia.isPosted && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400">Posted</span>
                            )}
                          </div>
                        </div>
                        {/* Per-item QA actions */}
                        {captionTicketId && selectedMedia.contentItemId && (() => {
                          const itemId = selectedMedia.contentItemId!;
                          const pending = pendingActions[itemId];
                          const effectiveStatus = pending
                            ? (pending === 'approve' ? 'approved' : pending === 'reject' ? 'rejected' : 'submitted')
                            : selectedMedia.captionStatus;

                          if (effectiveStatus === 'submitted') return (
                            <div className="mt-2 space-y-2">
                              {rejectingItemId === itemId ? (
                                /* Inline rejection form */
                                <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-2.5 space-y-2">
                                  <textarea
                                    ref={rejectReasonRef}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Rejection reason (optional)..."
                                    rows={2}
                                    className="w-full rounded-lg border border-red-500/20 bg-white/80 dark:bg-gray-900/80 px-2.5 py-1.5 text-xs text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 resize-none"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleQAItemAction(itemId, 'reject', rejectReason.trim() || undefined)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-red-500 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-red-600 transition-colors"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      Confirm Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setRejectingItemId(null); setRejectReason(''); }}
                                      className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Approve / Reject buttons */
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleQAItemAction(itemId, 'approve')}
                                    disabled={!!pending}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {pending === 'approve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setRejectingItemId(itemId); setRejectReason(''); }}
                                    disabled={!!pending}
                                    className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          );

                          if (effectiveStatus === 'approved') return (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQAItemAction(itemId, 'revert')}
                                disabled={!!pending}
                                className="inline-flex items-center gap-1 rounded-lg bg-gray-500/10 border border-gray-500/25 text-gray-400 hover:bg-gray-500/20 px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
                              >
                                {pending === 'revert' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                                Revoke
                              </button>
                            </div>
                          );

                          return null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Filmstrip thumbnails */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {mediaWithCaptions.map((m, i) => {
                      const badge = m.captionStatus ? CAPTION_STATUS_BADGE[m.captionStatus] : null;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedItemIndex(i)}
                          className={`relative shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all ${
                            i === selectedItemIndex
                              ? 'border-brand-light-pink ring-1 ring-brand-light-pink/30'
                              : 'border-transparent hover:border-gray-400/50'
                          }`}
                        >
                          <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          {badge && (
                            <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${badge.bgClass.replace('/10', '')}`} />
                          )}
                          {m.isPosted && (
                            <div className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-purple-400 ring-1 ring-black/20" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-brand-mid-pink/25 bg-gray-50/50 dark:bg-gray-900/30 p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="h-12 w-12 rounded-full bg-brand-light-pink/10 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-brand-light-pink" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No media attached to this board item</p>
                </div>
              )}
            </div>

            <ActivityFeed
              comments={comments}
              history={history}
              onAddComment={handleAddComment}
              currentUserName={user?.firstName ?? user?.username ?? 'User'}
              currentUserClerkId={user?.id}
              members={spaceMembers}
              isLoading={commentsLoading}
            />
          </div>

          {/* Right — set metadata */}
          <div className="px-5 py-6 bg-gray-50/70 dark:bg-gray-950/60 space-y-5">

            {/* Column selector */}
            {columns && columns.length > 0 && onColumnChange && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5"><Layers className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</span></div>
                <select
                  value={columns.find((c) => c.name === columnTitle)?.id ?? ''}
                  onChange={(e) => onColumnChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-brand-mid-pink/20 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-light-pink/60"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><Layers className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</span></div>
              <SelectField value={category} options={CATEGORY_OPTIONS} onSave={(v) => updateMeta({ category: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><ImageIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Set Size</span></div>
              <EditableField value={String(mediaWithCaptions.length || setSize)} placeholder="Number of images" onSave={(v) => updateMeta({ setSize: Number(v) || 0 })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Model</span></div>
              <EditableField value={model} placeholder="Model name" onSave={(v) => updateMeta({ model: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Assignee</span></div>
              <SearchableDropdown
                value={getMemberName(task.assignee) ?? ''}
                placeholder="Unassigned"
                searchPlaceholder="Search members..."
                options={spaceMembers.map((m) => getMemberName(m.user.clerkId) ?? m.user.email)}
                onChange={(v) => {
                  if (!v) { onUpdate({ ...task, assignee: undefined }); }
                  else {
                    const member = spaceMembers.find((m) => (getMemberName(m.user.clerkId) ?? m.user.email) === v);
                    if (member) onUpdate({ ...task, assignee: member.user.clerkId });
                  }
                }}
                clearable
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><ImageIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Quality</span></div>
              <SelectField value={quality} options={QUALITY_OPTIONS} onSave={(v) => updateMeta({ quality: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><ShieldCheck className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Watermarked</span></div>
              <button type="button" onClick={() => updateMeta({ watermarked: !watermarked })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${watermarked ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                <span className={`h-2 w-2 rounded-full ${watermarked ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {watermarked ? 'Yes' : 'No'}
              </button>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><Tag className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tags</span></div>
              {tags.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">{tags.map((t) => (<span key={t} className="inline-flex items-center rounded-full bg-brand-light-pink/10 text-brand-light-pink px-2 py-0.5 text-[10px] font-medium">{t}</span>))}</div>
              ) : (<span className="text-xs text-gray-400 italic">No tags</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
