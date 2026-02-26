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

const REQUEST_TYPE_OPTIONS = ['OTP', 'PTR', 'CUSTOM'];
const TYPE_COLORS: Record<string, string> = {
  OTP: 'bg-brand-blue/10 text-brand-blue',
  PTR: 'bg-brand-light-pink/10 text-brand-light-pink',
  CUSTOM: 'bg-amber-500/10 text-amber-600',
};


/**
 * OTP/PTR detail — order/request management layout.
 * Header: title + type badge (OTP/PTR/CUSTOM) + prominent paid/unpaid + price.
 * Top bar: buyer, model, deadline — key info at a glance.
 * Left: fulfillment notes, deliverables checklist, activity.
 * Right: all editable fields (request type, price, buyer, model, deadline, paid toggle, deliverables).
 */
export function OtpPtrTaskDetailModal({ task, columnTitle, isOpen, onClose, onUpdate }: Props) {
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
  const [editingNotes, setEditingNotes] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const meta = task.metadata ?? {};
  const requestType = (meta.requestType as string) ?? 'OTP';
  const price = (meta.price as number) ?? 0;
  const buyer = (meta.buyer as string) ?? '';
  const model = (meta.model as string) ?? '';
  const deliverables = Array.isArray(meta.deliverables) ? (meta.deliverables as string[]) : [];
  const deadline = (meta.deadline as string) ?? '';
  const isPaid = (meta.isPaid as boolean) ?? false;
  const fulfillmentNotes = (meta.fulfillmentNotes as string) ?? '';

  const [notesDraft, setNotesDraft] = useState(fulfillmentNotes);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setTitleDraft(task.title); setNotesDraft(fulfillmentNotes); }, [task, fulfillmentNotes]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingNotes) notesRef.current?.focus(); }, [editingNotes]);

  if (!mounted || !isOpen) return null;

  const updateMeta = (partial: Record<string, unknown>) => onUpdate({ ...task, metadata: { ...meta, ...partial } });
  const saveTitle = () => { setEditingTitle(false); if (titleDraft.trim() && titleDraft !== task.title) onUpdate({ ...task, title: titleDraft.trim() }); else setTitleDraft(task.title); };
  const saveNotes = () => { setEditingNotes(false); if (notesDraft !== fulfillmentNotes) updateMeta({ fulfillmentNotes: notesDraft }); };

  const typeStyle = TYPE_COLORS[requestType] ?? 'bg-gray-100 text-gray-500';

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-3" onClick={onClose}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-brand-mid-pink/20 overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* ── Header: title + type + paid status + price ────── */}
        <div className="px-6 sm:px-8 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="inline-flex items-center rounded-md bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[11px] font-bold tracking-wide">{task.taskKey}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${typeStyle}`}>
                  <ClipboardList className="h-3 w-3" />{requestType}
                </span>
                <button type="button" onClick={() => updateMeta({ isPaid: !isPaid })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${isPaid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                  <span className={`h-2 w-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {isPaid ? 'PAID' : 'UNPAID'}
                </button>
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
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Price</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-brand-off-white">${price.toFixed(2)}</p>
              </div>
              <button type="button" onClick={onClose} className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-brand-mid-pink/30 bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:text-gray-900 dark:hover:text-brand-off-white hover:border-brand-light-pink/60 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick-info bar */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/15 px-4 py-2.5 text-xs">
            {buyer && (
              <div className="flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Buyer:</span>
                <span className="font-semibold text-gray-800 dark:text-brand-off-white">@{buyer}</span>
              </div>
            )}
            {model && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Model:</span>
                <span className="font-semibold text-gray-800 dark:text-brand-off-white">{model}</span>
              </div>
            )}
            {deadline && (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">Deadline:</span>
                <span className="font-semibold text-gray-800 dark:text-brand-off-white">{deadline}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-brand-mid-pink/15" />

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">

          {/* Left — fulfillment notes, deliverables, activity */}
          <div className="px-6 sm:px-8 py-6 border-r-0 lg:border-r border-gray-200 dark:border-brand-mid-pink/15 min-h-[45vh]">

            {/* Fulfillment Notes */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Fulfillment Notes</h3>
              <div className="group/notes">
                {editingNotes ? (
                  <div>
                    <textarea ref={notesRef} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={5} placeholder="Delivery instructions, special requests..."
                      className="w-full rounded-xl border border-brand-light-pink/40 bg-white/80 dark:bg-gray-900/80 px-3 py-2.5 text-sm text-gray-800 dark:text-brand-off-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light-pink/60 resize-none" />
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={saveNotes} className="px-3 py-1.5 rounded-lg bg-brand-light-pink text-white text-xs font-medium hover:bg-brand-mid-pink">Save</button>
                      <button type="button" onClick={() => { setNotesDraft(fulfillmentNotes); setEditingNotes(false); }} className="px-3 py-1.5 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingNotes(true)} className="flex items-start gap-2 w-full text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap flex-1">{fulfillmentNotes || <span className="text-gray-400 italic">Click to add fulfillment notes...</span>}</p>
                    <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover/notes:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Deliverables */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Deliverables</h3>
              {deliverables.length > 0 ? (
                <div className="space-y-1.5">
                  {deliverables.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-brand-mid-pink/15 px-3 py-2">
                      <Package className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{d}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No deliverables specified</p>
              )}
            </div>

            {/* Description (secondary) */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Description</h3>
              <EditableField value={task.description ?? ''} placeholder="Additional details..." onSave={(v) => onUpdate({ ...task, description: v || undefined })} />
            </div>

            <ActivityFeed
              comments={comments}
              history={history}
              onAddComment={handleAddComment}
              currentUserName={user?.firstName ?? user?.username ?? 'User'}
              isLoading={commentsLoading}
            />
          </div>

          {/* Right — order details */}
          <div className="px-5 py-6 bg-gray-50/70 dark:bg-gray-950/60 space-y-5">

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><ClipboardList className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Request Type</span></div>
              <SelectField value={requestType} options={REQUEST_TYPE_OPTIONS} onSave={(v) => updateMeta({ requestType: v })}
                renderOption={(v) => (<span className="flex items-center gap-2 text-sm text-gray-800 dark:text-brand-off-white"><span className={`h-2 w-2 rounded-full ${v === 'OTP' ? 'bg-brand-blue' : v === 'PTR' ? 'bg-brand-light-pink' : 'bg-amber-500'}`} />{v}</span>)} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><DollarSign className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Price</span></div>
              <EditableField value={String(price)} placeholder="0.00" onSave={(v) => updateMeta({ price: Number(v) || 0 })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><Tag className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Buyer</span></div>
              <EditableField value={buyer} placeholder="@username" onSave={(v) => updateMeta({ buyer: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><User className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Model</span></div>
              <EditableField value={model} placeholder="Model name" onSave={(v) => updateMeta({ model: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><CalendarDays className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Deadline</span></div>
              <EditableField value={deadline} type="date" placeholder="Not set" onSave={(v) => updateMeta({ deadline: v })} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><ShieldCheck className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Payment Status</span></div>
              <button type="button" onClick={() => updateMeta({ isPaid: !isPaid })}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${isPaid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                <span className={`h-2 w-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isPaid ? 'Paid' : 'Unpaid'}
              </button>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><Package className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Deliverables</span></div>
              {deliverables.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap">{deliverables.map((d) => (<span key={d} className="inline-flex items-center rounded-full bg-brand-blue/10 text-brand-blue px-2 py-0.5 text-[10px] font-medium">{d}</span>))}</div>
              ) : (<span className="text-xs text-gray-400 italic">None</span>)}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><FileText className="h-3.5 w-3.5 text-gray-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes Preview</span></div>
              <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{fulfillmentNotes || <span className="text-gray-400 italic">No notes</span>}</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
