'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  Sparkles,
} from 'lucide-react';
import type { BoardTask } from '../../board/BoardTaskCard';
import { EditableField } from '../../board/EditableField';
import { SelectField } from '../../board/SelectField';
import { ActivityFeed, type TaskComment, type TaskHistoryEntry } from '../../board/ActivityFeed';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import { useBoardItemComments, useAddComment } from '@/lib/hooks/useBoardItems.query';

interface Props {
  task: BoardTask;
  columnTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: BoardTask) => void;
}

const CATEGORY_OPTIONS = ['bedroom', 'outdoor', 'studio', 'selfie', 'cosplay', 'lingerie', 'other'];
const QUALITY_OPTIONS = ['SD', 'HD', '4K'];
const QUALITY_COLORS: Record<string, string> = { SD: 'bg-gray-200 text-gray-600', HD: 'bg-brand-blue/10 text-brand-blue', '4K': 'bg-brand-light-pink/10 text-brand-light-pink' };

const PLACEHOLDER_HISTORY: TaskHistoryEntry[] = [
  { id: 'h1', field: 'quality', oldValue: 'SD', newValue: 'HD', changedBy: 'Alex', changedAt: new Date(Date.now() - 86400000).toISOString() },
];

/**
 * Sexting Sets detail — media-set management card.
 * Top: title + category badge + quality badge + watermark indicator.
 * Left (wider): description, gallery/media zone.
 * Right (narrow): set details (category, set size, model, quality, watermark, tags), activity.
 */
export function SextingSetsTaskDetailModal({ task, columnTitle, isOpen, onClose, onUpdate }: Props) {
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

  const handleAddComment = (content: string) => {
    addCommentMutation.mutate(content);
  };

  const [mounted, setMounted] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const meta = task.metadata ?? {};
  const category = (meta.category as string) ?? '';
  const setSize = (meta.setSize as number) ?? 0;
  const model = (meta.model as string) ?? '';
  const quality = (meta.quality as string) ?? 'HD';
  const watermarked = (meta.watermarked as boolean) ?? false;
  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTitleDraft(task.title); setDescDraft(task.description ?? ''); }, [task]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDesc) descRef.current?.focus(); }, [editingDesc]);

  if (!mounted || !isOpen) return null;

  const updateMeta = (partial: Record<string, unknown>) => onUpdate({ ...task, metadata: { ...meta, ...partial } });
  const saveTitle = () => { setEditingTitle(false); if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() }); else setTitleDraft(task.title); };
  const saveDesc = () => { setEditingDesc(false); if (descDraft !== (task.description ?? '')) onUpdate({ ...task, description: descDraft }); };

  const qualityStyle = QUALITY_COLORS[quality] ?? 'bg-gray-100 text-gray-500';

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-3" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* ── Header: title + badges ─────────────────────────── */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[11px] font-bold tracking-wide">{task.taskKey}</span>
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

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">

          {/* Left — description + gallery zone */}
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

            {/* Gallery grid placeholder */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Gallery</h3>
                <span className="text-[10px] text-gray-400">{setSize} image{setSize !== 1 ? 's' : ''} in set</span>
              </div>
              {setSize > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: Math.min(setSize, 6) }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-brand-mid-pink/15 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                    </div>
                  ))}
                  {setSize > 6 && (
                    <div className="aspect-square rounded-xl bg-gray-100 dark:bg-gray-900/60 border border-gray-200 dark:border-brand-mid-pink/15 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-400">+{setSize - 6}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-brand-mid-pink/25 bg-gray-50/50 dark:bg-gray-900/30 p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="h-12 w-12 rounded-full bg-brand-light-pink/10 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-brand-light-pink" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upload images for this set</p>
                </div>
              )}
            </div>

            <ActivityFeed
              comments={comments}
              history={PLACEHOLDER_HISTORY}
              onAddComment={handleAddComment}
              currentUserName={user?.firstName ?? user?.username ?? 'User'}
              isLoading={commentsLoading}
            />
          </div>

          {/* Right — set metadata */}
          <div className="px-5 py-6 bg-gray-50/70 dark:bg-gray-950/60 space-y-5">

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><Layers className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Category</span></div>
              <SelectField value={category} options={CATEGORY_OPTIONS} onSave={(v) => updateMeta({ category: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><ImageIcon className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Set Size</span></div>
              <EditableField value={String(setSize)} placeholder="Number of images" onSave={(v) => updateMeta({ setSize: Number(v) || 0 })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Model</span></div>
              <EditableField value={model} placeholder="Model name" onSave={(v) => updateMeta({ model: v })} />
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
