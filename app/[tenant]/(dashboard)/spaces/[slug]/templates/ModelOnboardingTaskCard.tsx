'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, Check, X, User, Trash2, Rocket, Loader2 } from 'lucide-react';
import { useOrgMembers } from '@/lib/hooks/useOrgMembers.query';
import { useInstagramProfiles } from '@/lib/hooks/useInstagramProfiles.query';
import type { BoardTaskCardProps } from '../../board';

export const ModelOnboardingTaskCard = memo(function ModelOnboardingTaskCard({
  task,
  index,
  onClick,
  onTitleUpdate,
  onDelete,
  isSecondToLastColumn,
  onMoveToColumn,
  lastColumnId,
  onUpdateTask,
}: BoardTaskCardProps) {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchModelName, setLaunchModelName] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const launchInputRef = useRef<HTMLInputElement>(null);
  const { data: orgMembers = [] } = useOrgMembers();
  const { data: existingProfiles = [] } = useInstagramProfiles();

  const isDuplicateName = launchModelName.trim().length > 0 &&
    existingProfiles.some(
      (p) => p.name.toLowerCase() === launchModelName.trim().toLowerCase()
    );

  const meta = (task.metadata ?? {}) as Record<string, unknown>;
  const modelName = (meta.modelName as string) ?? '';
  const platform = (meta.platform as string) ?? '';
  const isLaunched = meta.launched === true;
  const checklist = Array.isArray(meta.checklist) ? (meta.checklist as { completed: boolean }[]) : [];
  const total = checklist.length;
  const done = checklist.filter((c) => c.completed).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => { setDraft(task.title); }, [task.title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => {
    if (showLaunchModal) {
      setLaunchModelName(modelName || task.title);
      setTimeout(() => launchInputRef.current?.focus(), 100);
    }
  }, [showLaunchModal, modelName, task.title]);

  const saveTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) onTitleUpdate?.(task, trimmed);
    else setDraft(task.title);
  };

  const handleConfirmLaunch = async () => {
    const finalName = launchModelName.trim();
    if (!finalName || isLaunching || isDuplicateName) return;
    setIsLaunching(true);
    try {
      // Create influencer profile shared to org
      const res = await fetch('/api/instagram-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          type: 'real',
          shareWithOrganization: true,
        }),
      });
      const newProfile = await res.json();

      // Update task metadata with launched flag and final model name
      if (onUpdateTask) {
        onUpdateTask({
          ...task,
          title: finalName,
          metadata: { ...meta, modelName: finalName, launched: true },
        });
      }

      // Move card to last column
      if (lastColumnId && onMoveToColumn) {
        onMoveToColumn(task.id, lastColumnId);
      }

      setShowLaunchModal(false);

      // Navigate to the newly created profile page
      if (newProfile?.id && params.tenant) {
        router.push(`/${params.tenant}/workspace/my-influencers/${newProfile.id}`);
      }
    } catch (err) {
      console.error('Launch failed:', err);
    } finally {
      setIsLaunching(false);
    }
  };

  const assigneeName = (() => {
    if (!task.assignee) return null;
    const m = orgMembers.find((mb) => mb.clerkId === task.assignee || mb.id === task.assignee);
    if (!m) return task.assignee;
    return m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
  })();

  const assigneeInitial = assigneeName?.charAt(0)?.toUpperCase() ?? null;

  return (
    <>
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => {
          const card = (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              onClick={() => { if (!editing) onClick?.(task); }}
              className={[
                'group/card relative rounded-xl cursor-pointer select-none',
                'bg-white/[0.03] dark:bg-[#1a2237]/80 backdrop-blur-sm border border-[#2a3450]/60',
                snapshot.isDragging
                  ? 'shadow-2xl shadow-black/40 border-brand-mid-pink/50 ring-1 ring-brand-light-pink/20 scale-[1.02]'
                  : 'hover:bg-white/[0.06] dark:hover:bg-[#1a2237] hover:border-[#2a3450] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5',
                'transition-all duration-200',
              ].join(' ')}
            >
              <div className="px-3.5 pt-3 pb-2.5">
                {/* Row 1: key + platform tag */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide bg-teal-500/15 border-teal-500/25 text-teal-400 font-mono">
                    {task.taskKey}
                  </span>
                  {platform && (
                    <span className="text-[10px] font-medium text-gray-500 dark:text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/[0.06] capitalize">
                      {platform}
                    </span>
                  )}
                  <span className="flex-1" />
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
                          onDelete(task.id);
                        }
                      }}
                      className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Row 2: Title */}
                {editing ? (
                  <div
                    className="flex items-center gap-1 mb-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle();
                        if (e.key === 'Escape') { setDraft(task.title); setEditing(false); }
                      }}
                      className="flex-1 min-w-0 rounded-lg bg-white/5 border border-brand-mid-pink/30 px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white focus-visible:outline-none focus-visible:border-brand-light-pink/60"
                    />
                    <button type="button" onClick={saveTitle} className="p-0.5 text-brand-light-pink shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => { setDraft(task.title); setEditing(false); }} className="p-0.5 text-gray-500 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] font-bold leading-snug text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {task.title}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                      className="inline-block ml-1 opacity-0 group-hover/card:opacity-100 transition-opacity rounded p-0.5 align-middle hover:bg-white/[0.08]"
                    >
                      <Pencil className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                    </button>
                  </p>
                )}

                {/* Row 3: Model name */}
                {modelName && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-400 mb-2">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{modelName}</span>
                  </div>
                )}

                {/* Row 4: Mini progress bar */}
                {total > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold ${progress === 100 ? 'text-emerald-400' : 'text-brand-light-pink'}`}>
                        {done}/{total}
                      </span>
                      <span className={`text-[10px] font-bold ${progress === 100 ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {progress}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-light-pink'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Model Launched badge (persisted via metadata) */}
                {isLaunched ? (
                  <div className="mb-2">
                    <div className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold">
                      <Rocket className="h-3 w-3" />
                      Model Launched
                    </div>
                  </div>
                ) : isSecondToLastColumn ? (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLaunchModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all"
                    >
                      <Rocket className="h-3 w-3" />
                      Mark as Launched
                    </button>
                  </div>
                ) : null}

                {/* Footer: assignee */}
                <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/[0.06]">
                  <span className="flex-1" />
                  {assigneeInitial ? (
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-light-pink/15 text-brand-light-pink text-[11px] font-bold ring-1 ring-brand-light-pink/20 group-hover/card:ring-brand-light-pink/40 transition-all"
                      title={assigneeName ?? undefined}
                    >
                      {assigneeInitial}
                    </span>
                  ) : (
                    <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-600" />
                  )}
                </div>
              </div>
            </div>
          );

          if (snapshot.isDragging) return createPortal(card, document.body);
          return card;
        }}
      </Draggable>

      {/* Launch Confirmation Modal */}
      {showLaunchModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !isLaunching && setShowLaunchModal(false)}
          >
            <div
              className="w-full max-w-md mx-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/[0.08] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Rocket className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Confirm Model Launch
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  This will mark the model as launched and create an influencer profile shared with your organization.
                </p>

                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Final Model Name
                </label>
                <input
                  ref={launchInputRef}
                  type="text"
                  value={launchModelName}
                  onChange={(e) => setLaunchModelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmLaunch();
                    if (e.key === 'Escape') setShowLaunchModal(false);
                  }}
                  className={`w-full rounded-lg border bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 ${
                    isDuplicateName
                      ? 'border-red-400 dark:border-red-500/50 focus-visible:ring-red-500/60'
                      : 'border-gray-200 dark:border-white/[0.1] focus-visible:ring-emerald-500/60 focus-visible:border-emerald-500/40'
                  }`}
                  placeholder="Enter model name..."
                />
                {isDuplicateName && (
                  <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 font-medium">
                    A profile with this name already exists. Please use a unique name.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-white/[0.06]">
                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => setShowLaunchModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLaunching || !launchModelName.trim() || isDuplicateName}
                  onClick={handleConfirmLaunch}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLaunching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" />
                      Confirm Launch
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
});
