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
  Hash,
  Upload,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import { ActivityFeed, type TaskComment, type TaskHistoryEntry } from '../../board/ActivityFeed';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useBoardItemComments, useAddComment, useBoardItemHistory } from '@/lib/hooks/useBoardItems.query';

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

const PLATFORM_OPTIONS = ['onlyfans', 'fansly', 'instagram', 'twitter', 'reddit'];
const PLATFORM_COLORS: Record<string, string> = {
  onlyfans: 'bg-sky-500/10 text-sky-600',
  fansly: 'bg-brand-light-pink/10 text-brand-light-pink',
  instagram: 'bg-purple-500/10 text-purple-600',
  twitter: 'bg-blue-500/10 text-blue-500',
  reddit: 'bg-orange-500/10 text-orange-600',
};


/**
 * Wall Post detail — content-editor style.
 * Top: title + platform badge.
 * Left (wider): large caption editor, media upload area.
 * Right (narrow): scheduling, model, hashtags, media count, activity.
 */
export function WallPostTaskDetailModal({ task, columnTitle, isOpen, onClose, onUpdate }: Props) {
  const params = useParams<{ slug: string }>();
  const { data: space } = useSpaceBySlug(params.slug);
  const { user } = useUser();
  const spaceId = space?.id;
  const boardId = space?.boards?.[0]?.id;

  // Fetch real comments from API - only when modal is open
  const { data: commentsData, isLoading: commentsLoading } = useBoardItemComments(spaceId, boardId, task.id, isOpen);
  const addCommentMutation = useAddComment(spaceId ?? '', boardId ?? '', task.id);

  // Map API BoardItemComment → ActivityFeed TaskComment
  const comments: TaskComment[] = useMemo(() => {
    if (!commentsData?.comments) return [];
    const currentUserId = user?.id;
    return commentsData.comments.map((c) => ({
      id: c.id,
      author: c.createdBy === currentUserId
        ? (user?.firstName ?? user?.username ?? 'You')
        : c.createdBy,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }, [commentsData, user]);

  // Fetch real history from API
  const { data: historyData } = useBoardItemHistory(spaceId, boardId, task.id);
  const history: TaskHistoryEntry[] = useMemo(() => {
    if (!historyData?.history) return [];
    const currentUserId = user?.id;
    return historyData.history.map((h) => ({
      id: h.id,
      action: h.action,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.userId === currentUserId
        ? (user?.firstName ?? user?.username ?? 'You')
        : h.userId,
      changedAt: h.createdAt,
    }));
  }, [historyData, user]);

  const handleAddComment = (content: string) => {
    addCommentMutation.mutate(content);
  };

  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const meta = task.metadata ?? {};
  const caption = (meta.caption as string) ?? '';
  const platform = (meta.platform as string) ?? '';
  const hashtags = Array.isArray(meta.hashtags) ? (meta.hashtags as string[]) : [];
  const scheduledDate = (meta.scheduledDate as string) ?? '';
  const model = (meta.model as string) ?? '';
  const mediaCount = (meta.mediaCount as number) ?? 0;

  const [captionDraft, setCaptionDraft] = useState(caption);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTitleDraft(task.title); setCaptionDraft(caption); }, [task, caption]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingCaption) captionRef.current?.focus(); }, [editingCaption]);

  if (!mounted || !isOpen) return null;

  const updateMeta = (partial: Record<string, unknown>) => onUpdate({ ...task, metadata: { ...meta, ...partial } });
  const saveTitle = () => { setEditingTitle(false); if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() }); else setTitleDraft(task.title); };
  const saveCaption = () => { setEditingCaption(false); if (captionDraft !== caption) updateMeta({ caption: captionDraft }); };

  const platformStyle = PLATFORM_COLORS[platform] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500';

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-3" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* ── Header: title + platform badge + status ──────── */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[11px] font-bold tracking-wide">{task.taskKey}</span>
              {platform && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${platformStyle}`}>
                  <AtSign className="h-3 w-3" />{platform}
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

        {/* ── Body: content area (left) + details panel (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">

          {/* Left — Caption editor + media upload zone */}
          <div className="px-6 sm:px-8 py-6 border-r-0 lg:border-r border-gray-200 dark:border-brand-mid-pink/15 min-h-[50vh]">

            {/* Caption */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Caption</h3>
              <div className="group/cap">
                {editingCaption ? (
                  <div>
                    <textarea ref={captionRef} value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} rows={6} placeholder="Write your post caption..."
                      className="w-full rounded-xl border border-brand-light-pink/40 bg-white/80 dark:bg-gray-900/80 px-4 py-3 text-sm text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60 resize-none leading-relaxed" />
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={saveCaption} className="px-3 py-1.5 rounded-lg bg-brand-light-pink text-white text-xs font-medium hover:bg-brand-mid-pink">Save</button>
                      <button type="button" onClick={() => { setCaptionDraft(caption); setEditingCaption(false); }} className="px-3 py-1.5 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingCaption(true)} className="flex items-start gap-2 w-full text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap flex-1 leading-relaxed">{caption || <span className="text-gray-400 italic">Click to write a caption...</span>}</p>
                    <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover/cap:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Hashtags inline */}
            {hashtags.length > 0 && (
              <div className="mb-6 flex items-center gap-1.5 flex-wrap">
                {hashtags.map((h) => (
                  <span key={h} className="inline-flex items-center rounded-full bg-brand-blue/10 text-brand-blue px-2.5 py-0.5 text-[11px] font-medium">#{h}</span>
                ))}
              </div>
            )}

            {/* Media upload zone */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Media</h3>
              <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-brand-mid-pink/25 bg-gray-50/50 dark:bg-gray-900/30 p-8 flex flex-col items-center justify-center gap-3 text-center">
                <div className="h-12 w-12 rounded-full bg-brand-light-pink/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-brand-light-pink" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Drag &amp; drop media here, or <span className="text-brand-light-pink font-medium cursor-pointer hover:underline">browse</span>
                </p>
                <p className="text-[10px] text-gray-400">
                  {mediaCount > 0 ? `${mediaCount} file(s) attached` : 'No files yet'}
                </p>
              </div>
            </div>

            {/* Activity */}
            <ActivityFeed
              comments={comments}
              history={history}
              onAddComment={handleAddComment}
              currentUserName={user?.firstName ?? user?.username ?? 'User'}
              isLoading={commentsLoading}
            />
          </div>

          {/* Right — scheduling & post details */}
          <div className="px-5 py-6 bg-gray-50/70 dark:bg-gray-950/60 space-y-5">

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AtSign className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Platform</span>
              </div>
              <SelectField value={platform} options={PLATFORM_OPTIONS} onSave={(v) => updateMeta({ platform: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Scheduled Date</span>
              </div>
              <EditableField value={scheduledDate} type="date" placeholder="Not scheduled" onSave={(v) => updateMeta({ scheduledDate: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Model</span>
              </div>
              <EditableField value={model} placeholder="Model name" onSave={(v) => updateMeta({ model: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Media Count</span>
              </div>
              <EditableField value={String(mediaCount)} placeholder="0" onSave={(v) => updateMeta({ mediaCount: Number(v) || 0 })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Hash className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Hashtags</span>
              </div>
              {hashtags.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">{hashtags.map((h) => (<span key={h} className="inline-flex items-center rounded-full bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[10px] font-medium">#{h}</span>))}</div>
              ) : (<span className="text-xs text-gray-400 italic">No hashtags</span>)}
            </div>

            {/* Description (secondary for wall posts) */}
            <div className="pt-4 border-t border-gray-200 dark:border-brand-mid-pink/15">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Pencil className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</span>
              </div>
              <EditableField value={task.description ?? ''} placeholder="Internal notes..." onSave={(v) => onUpdate({ ...task, description: v || undefined })} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
