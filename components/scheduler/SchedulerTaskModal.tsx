'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Play,
  CheckCircle2,
  SkipForward,
  ChevronDown,
  Trash2,
  X,
  Loader2,
  Lock,
  Save,
  ArrowLeft,
  Send,
  Flag,
  History,
  TrendingUp,
  GitBranch,
  Hourglass,
  XCircle,
  Images,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SchedulerTask,
  TASK_FIELD_DEFS,
  TaskFields,
  FOLLOW_UP_SUB_TYPES,
  isTaskLocked,
  useQueueTaskUpdate,
  useTaskLineage,
  useTaskHistory,
  useLineageHistory,
  useLineageEarnings,
  TaskHistoryItem,
  LineageHistoryItem,
  MM_SUB_TYPES,
  MM_SUB_TYPE_ICONS,
  WP_SUB_TYPES,
  WP_SUB_TYPE_ICONS,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS, TaskViewerBanner } from './task-cards/shared';
import { formatTimeInTz, formatDuration } from '@/lib/scheduler/time-helpers';
import { CaptionPicker, type CaptionSelection } from './pickers/CaptionPicker';
import { QueueCalendar } from './QueueCalendar';

function getCaptionCategory(taskType: string, subType?: string): string {
  if (taskType === 'MM') {
    if (subType === 'Follow Up') return 'MM Follow Up';
    if (subType === 'Photo Bump') return 'MM Photo Bump';
    return 'MM Unlock';
  }
  if (taskType === 'WP') return 'Wall Post';
  if (taskType === 'SP') return 'Sub Promo';
  return taskType;
}

const TYPES_WITH_PICKER = new Set(['MM', 'WP', 'SP']);

const LA_TZ = 'America/Los_Angeles';

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'PENDING', label: 'Pending', color: '#3a3a5a' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#38bdf8' },
  { key: 'DONE', label: 'Done', color: '#4ade80' },
  { key: 'SKIPPED', label: 'Skipped', color: '#fbbf24' },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  IN_PROGRESS: <Play className="h-3 w-3" />,
  DONE: <CheckCircle2 className="h-3 w-3" />,
  SKIPPED: <SkipForward className="h-3 w-3" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  free: '#4ade80',
  paid: '#f472b6',
  oftv: '#38bdf8',
  fansly: '#c084fc',
};

const PLATFORM_LABELS: Record<string, string> = {
  free: 'Free',
  paid: 'Paid',
  oftv: 'OFTV',
  fansly: 'Fansly',
};

interface SchedulerTaskModalProps {
  task: SchedulerTask;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  onDelete?: (id: string) => void;
  schedulerToday?: string;
  weekStart?: string;
  profileName?: string;
}

export function SchedulerTaskModal({
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
  schedulerToday,
  weekStart,
  profileName,
}: SchedulerTaskModalProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sidePanel, setSidePanel] = useState<'history' | 'lineage' | null>(null);
  const showHistory = sidePanel !== null;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // ─── Which task are we currently viewing/editing? ───
  // Defaults to the prop task, but can switch to a queued lineage task
  const [viewingTask, setViewingTask] = useState<SchedulerTask>(task);
  const isViewingOriginal = viewingTask.id === task.id;

  // ─── Queue target week (selected from calendar) ───
  const [queueTargetWeek, setQueueTargetWeek] = useState<string | null>(null);
  const queueMutation = useQueueTaskUpdate();

  const typeColor = TASK_TYPE_COLORS[viewingTask.taskType] || '#3a3a5a';
  const fieldDefs = TASK_FIELD_DEFS[viewingTask.taskType] || [];
  const serverFields = (viewingTask.fields || {}) as Record<string, string>;
  const locked = schedulerToday ? isTaskLocked(viewingTask, schedulerToday) : false;
  const hasLineage = !!task.lineageId;

  // ─── Lineage earnings (on-demand) ───
  const [showEarnings, setShowEarnings] = useState(false);
  const hasFinalAmountField = viewingTask.taskType === 'WP' ||
    (serverFields.type || viewingTask.taskName || '').toLowerCase().includes('unlock');
  const earningsQuery = useLineageEarnings(task.lineageId, showEarnings && hasFinalAmountField && hasLineage);

  // ─── Pending (unsaved) field changes ───
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  // Sexting set items for preview (not persisted to task fields)
  const [sextingSetPreview, setSextingSetPreview] = useState<CaptionSelection['sextingSetItems'] | null>(null);
  const [sextingSetName, setSextingSetName] = useState<string>('');
  const [sextingSelectedItemId, setSextingSelectedItemId] = useState<string | null>(null);
  const isDirty = Object.keys(pendingChanges).length > 0;

  // Merge for display: server + pending
  const fields = { ...serverFields, ...pendingChanges };
  const isFlagged = fields.flagged === 'true' || fields.flagged === true as unknown as string;

  // ─── Derive subType from lineage sibling if current task doesn't have one ───
  // Only fetch when modal is open to avoid firing for every task card on the grid
  const { data: lineageData } = useTaskLineage(open ? task.lineageId : null);
  const resolvedSubType = fields.subType || (() => {
    if (!lineageData?.tasks) return '';
    const sibling = lineageData.tasks.find((t) => {
      const f = (t.fields || {}) as Record<string, string>;
      return f.subType;
    });
    return sibling ? ((sibling.fields || {}) as Record<string, string>).subType || '' : '';
  })();

  // ─── Style (subType): detect unlock/follow-up ───
  const typeName = (fields.type || viewingTask.taskName || '').toLowerCase();
  const isUnlockOrFollowUp = viewingTask.taskType === 'MM' &&
    (typeName.includes('unlock') || typeName.includes('follow up') || typeName.includes('follow-up'));

  const handleStyleChange = useCallback((newStyle: string) => {
    // Save immediately — the grid's handleUpdate will sync subType to the sibling
    const currentFields = { ...serverFields, ...pendingChanges, subType: newStyle } as TaskFields;
    onUpdate(viewingTask.id, { fields: currentFields });
    // Remove subType from pending since it's saved immediately
    setPendingChanges((prev) => {
      const { subType: _, ...rest } = prev;
      return rest;
    });
    setShowStyleMenu(false);
  }, [serverFields, pendingChanges, viewingTask.id, onUpdate]);

  // Reset when opening a different task from parent
  const lastTaskIdRef = useRef(task.id);
  useEffect(() => {
    if (lastTaskIdRef.current !== task.id) {
      lastTaskIdRef.current = task.id;
      setViewingTask(task);
      setPendingChanges({});
      setQueueTargetWeek(null);
      setShowEarnings(false);
      setSextingSetPreview(null);
      setSextingSelectedItemId(null);
      setSextingSetName('');
    }
  }, [task]);

  // Also update viewingTask if the parent task data refreshes (same ID, new data)
  useEffect(() => {
    if (viewingTask.id === task.id) {
      setViewingTask(task);
    }
  }, [task]);

  // ─── Navigate to a lineage task (from calendar click) ───
  const handleSelectLineageTask = useCallback((t: SchedulerTask) => {
    setViewingTask(t);
    setPendingChanges({});
    setQueueTargetWeek(null);
  }, []);

  const handleBackToOriginal = useCallback(() => {
    setViewingTask(task);
    setPendingChanges({});
    setQueueTargetWeek(null);
  }, [task]);

  // ─── When a queued task is deleted, go back to original if we were viewing it ───
  const handleDeleteQueuedTask = useCallback((deletedTaskId: string) => {
    if (viewingTask.id === deletedTaskId) {
      setViewingTask(task);
      setPendingChanges({});
      setQueueTargetWeek(null);
    }
  }, [viewingTask.id, task]);

  // ─── Explicit save ───
  const handleSave = useCallback(() => {
    if (!isDirty) return;
    setIsSaving(true);
    const merged = { ...serverFields, ...pendingChanges } as TaskFields;
    const m = merged as Record<string, unknown>;

    // Detect caption change → send to QA if flagged or already in QA flow
    const captionChanged = pendingChanges.caption !== undefined ||
                           pendingChanges.captionBankText !== undefined ||
                           pendingChanges.captionId !== undefined;
    const wasFlagged = serverFields.flagged === 'true' || serverFields.flagged === true as unknown as string;
    const alreadyInQA = !!serverFields.captionQAStatus;
    const shouldSendToQA = captionChanged && (wasFlagged || alreadyInQA);

    if (shouldSendToQA) {
      m.captionQAStatus = 'sent_to_qa';
      m.flagged = '';
      // Keep original _previousCaption from the first send; only set if not already stored
      if (!serverFields._previousCaption) {
        const prevCaption = serverFields.captionBankText || serverFields.caption || '';
        if (prevCaption) m._previousCaption = prevCaption;
      }
      // For follow-up tasks, include the sibling unlock's paywallContent
      const isFollowUpTask = viewingTask.taskType === 'MM' &&
        (typeName.includes('follow up') || typeName.includes('follow-up'));
      if (isFollowUpTask && lineageData?.tasks) {
        const unlockSibling = lineageData.tasks.find((t) => {
          const f = (t.fields || {}) as Record<string, string>;
          const tName = (f.type || t.taskName || '').toLowerCase();
          return tName.includes('unlock') && f.paywallContent;
        });
        if (unlockSibling) {
          const unlockFields = (unlockSibling.fields || {}) as Record<string, string>;
          m._unlockPaywallContent = unlockFields.paywallContent;
        }
      }
    }

    onUpdate(viewingTask.id, { fields: merged });
    setPendingChanges({});

    if (shouldSendToQA) {
      toast.info('Caption sent to QA for review', { duration: 4000 });
    }

    setTimeout(() => setIsSaving(false), 400);
  }, [isDirty, serverFields, pendingChanges, viewingTask.id, onUpdate, typeName, lineageData]);

  // ─── Queue: create a copy for the selected future week ───
  const handleQueue = useCallback(() => {
    if (!queueTargetWeek) return;
    const currentFields = { ...serverFields, ...pendingChanges } as TaskFields;
    queueMutation.mutate(
      {
        sourceTaskId: task.id,
        weekStart: queueTargetWeek,
        dayOfWeek: task.dayOfWeek,
        fields: currentFields,
      },
      {
        onSuccess: () => {
          setQueueTargetWeek(null);
          setPendingChanges({});
          // Auto-unflag the original task after successful queue
          const isFlagged = serverFields.flagged === 'true' || serverFields.flagged === (true as unknown as string);
          if (isFlagged) {
            onUpdate(task.id, { fields: { ...serverFields, ...pendingChanges, flagged: 'false' } as TaskFields });
          }
        },
      },
    );
  }, [queueTargetWeek, serverFields, pendingChanges, task.id, task.dayOfWeek, queueMutation, onUpdate]);

  // ─── Field change handlers (local only, no auto-save) ───
  const handleFieldChange = useCallback((key: string, val: string) => {
    setPendingChanges((prev) => ({ ...prev, [key]: val.trim() }));
  }, []);

  const handleSelectCaption = useCallback((sel: CaptionSelection) => {
    const patch: Record<string, string> = {
      captionId: sel.captionId,
      captionBankText: sel.captionText,
      caption: sel.captionText,
      flyerAssetUrl: sel.gifUrl,
      flyerAssetId: sel.boardItemId || '',
    };
    if (sel.sextingSetName) {
      patch.caption = sel.captionText;
      patch.sextingSetName = sel.sextingSetName;
      patch.contentPreview = sel.sextingSetName;
    }
    if (sel.contentCount) {
      patch.paywallContent = sel.contentCount + (sel.contentLength ? ` (${sel.contentLength})` : '');
    }
    if (sel.price > 0) {
      patch.price = `$${sel.price.toFixed(2)}`;
    }
    if (sel.contentType) {
      patch.tag = sel.contentType;
    }
    setPendingChanges((prev) => ({ ...prev, ...patch }));
    // Store sexting set items for preview (if applicable)
    setSextingSetPreview(sel.sextingSetItems ?? null);
    setSextingSelectedItemId(null);
    setSextingSetName(sel.sextingSetName ?? '');
  }, []);

  const handleClearCaption = useCallback(() => {
    setPendingChanges((prev) => ({ ...prev, captionId: '', captionBankText: '', sextingSetName: '' }));
    setSextingSetPreview(null);
    setSextingSelectedItemId(null);
    setSextingSetName('');
  }, []);

  const handleCaptionOverride = useCallback((text: string) => {
    setPendingChanges((prev) => ({ ...prev, caption: text, captionId: '', captionBankText: '' }));
  }, []);

  // ─── Close dropdown on outside click ───
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) setShowStyleMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Status changes remain immediate (not field edits)
  const handleStatusChange = useCallback((newStatus: string) => {
    const updates: Partial<SchedulerTask> = { status: newStatus as SchedulerTask['status'] };
    if (newStatus === 'IN_PROGRESS' && !viewingTask.startTime) updates.startTime = new Date().toISOString();
    if (newStatus === 'DONE' && viewingTask.startTime && !viewingTask.endTime) updates.endTime = new Date().toISOString();
    onUpdate(viewingTask.id, updates);
    setShowStatusMenu(false);
  }, [viewingTask, onUpdate]);

  const scrollToCalendar = useCallback(() => {
    calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!open) return null;

  const statusOpt = STATUS_OPTIONS.find((s) => s.key === viewingTask.status) || STATUS_OPTIONS[0];

  // Week label for the viewing task
  const viewingWs = typeof viewingTask.weekStartDate === 'string' ? viewingTask.weekStartDate.split('T')[0] : String(viewingTask.weekStartDate);
  const viewingWsDate = new Date(viewingWs + 'T00:00:00Z');
  const viewingWeekLabel = !isNaN(viewingWsDate.getTime())
    ? viewingWsDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : viewingWs;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className={['flex gap-0 mx-4 max-h-[90vh]', showHistory ? 'max-w-6xl' : 'max-w-4xl'].join(' ')}>
      {/* Main modal */}
      <div
        className={['w-full rounded-xl border bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#1a1a2e] shadow-2xl flex flex-col', showHistory ? 'rounded-r-none border-r-0' : ''].join(' ')}
        style={{ borderTopWidth: 3, borderTopColor: typeColor }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#111124]">
          <div className="flex items-center gap-2">
            {/* Back button when viewing a different task */}
            {!isViewingOriginal && (
              <button
                onClick={handleBackToOriginal}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full font-sans transition-colors border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
                title="Back to current week"
              >
                <ArrowLeft className="h-2.5 w-2.5" />
                Back
              </button>
            )}

            {/* Profile name + platform badge */}
            {(profileName || viewingTask.platform) && (
              <div className="flex items-center gap-1.5">
                {profileName && (
                  <span className="text-[10px] font-bold font-sans text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                    {profileName}
                  </span>
                )}
                {viewingTask.platform && (
                  <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded-full font-sans border"
                    style={{
                      background: (PLATFORM_COLORS[viewingTask.platform] || '#888') + '15',
                      color: PLATFORM_COLORS[viewingTask.platform] || '#888',
                      borderColor: (PLATFORM_COLORS[viewingTask.platform] || '#888') + '30',
                    }}
                  >
                    {PLATFORM_LABELS[viewingTask.platform] || viewingTask.platform}
                  </span>
                )}
                <div className="w-px h-3 bg-gray-200 dark:bg-[#1a1a2e]" />
              </div>
            )}

            {/* Type + Style label */}
            <div
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans border"
              style={{
                background: typeColor + '20',
                color: typeColor,
                border: `1px solid ${typeColor}40`,
              }}
            >
              {locked && <Lock className="h-2.5 w-2.5" />}
              <span>{viewingTask.taskType || 'TYPE'}</span>
            </div>

            {/* Style selector (unlock / follow-up MM tasks only) */}
            {isUnlockOrFollowUp && (
              <div className="relative" ref={styleMenuRef}>
                <button
                  onClick={() => !locked && setShowStyleMenu(!showStyleMenu)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans border transition-colors"
                  style={{
                    background: resolvedSubType ? typeColor + '15' : 'transparent',
                    color: resolvedSubType ? typeColor : '#888',
                    border: `1px solid ${resolvedSubType ? typeColor + '40' : '#88888830'}`,
                    opacity: locked ? 0.6 : 1,
                  }}
                  disabled={locked}
                >
                  {resolvedSubType || 'Style'}
                  {!locked && <ChevronDown className="h-2.5 w-2.5" />}
                </button>
                {showStyleMenu && !locked && (
                  <div className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[140px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                    {FOLLOW_UP_SUB_TYPES.map((style) => (
                      <button
                        key={style}
                        onClick={() => handleStyleChange(style)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-800"
                        style={{ color: style === resolvedSubType ? typeColor : undefined }}
                      >
                        {style === resolvedSubType && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: typeColor }} />}
                        {style}
                      </button>
                    ))}
                    {resolvedSubType && (
                      <>
                        <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                        <button
                          onClick={() => handleStyleChange('')}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left font-sans text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          None
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Status selector */}
            <div className="relative" ref={statusMenuRef}>
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border transition-all font-sans"
                style={{
                  color: statusOpt.color,
                  borderColor: statusOpt.color + '40',
                  background: statusOpt.color + '15',
                }}
              >
                {STATUS_ICONS[viewingTask.status]}
                {statusOpt.label.toUpperCase()}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[110px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleStatusChange(opt.key)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-800"
                      style={{ color: opt.color }}
                    >
                      {STATUS_ICONS[opt.key]}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Week label when viewing a non-original task */}
            {!isViewingOriginal && (
              <span className="text-[9px] font-mono text-gray-400 dark:text-gray-600 px-2 py-0.5 rounded bg-gray-50 dark:bg-gray-800">
                Week of {viewingWeekLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Flag toggle */}
            <button
              onClick={() => handleFieldChange('flagged', isFlagged ? '' : 'true')}
              className={[
                'p-1.5 rounded transition-colors',
                isFlagged
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-500'
                  : 'text-gray-400 dark:text-gray-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10',
              ].join(' ')}
              title={isFlagged ? 'Flagged — click to unflag' : 'Flag this task'}
            >
              <Flag className="h-3.5 w-3.5" fill={isFlagged ? 'currentColor' : 'none'} />
            </button>
            {/* Lineage toggle */}
            {hasLineage && (
              <button
                onClick={() => setSidePanel((p) => p === 'lineage' ? null : 'lineage')}
                className={[
                  'p-1.5 rounded transition-colors',
                  sidePanel === 'lineage'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'text-gray-400 dark:text-gray-600 hover:text-emerald-500 hover:bg-emerald-500/5',
                ].join(' ')}
                title={sidePanel === 'lineage' ? 'Hide lineage' : 'Show lineage'}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </button>
            )}
            {/* History toggle */}
            <button
              onClick={() => setSidePanel((p) => p === 'history' ? null : 'history')}
              className={[
                'p-1.5 rounded transition-colors',
                sidePanel === 'history'
                  ? 'bg-brand-blue/10 text-brand-blue'
                  : 'text-gray-400 dark:text-gray-600 hover:text-brand-blue hover:bg-brand-blue/5',
              ].join(' ')}
              title={sidePanel === 'history' ? 'Hide history' : 'Show history'}
            >
              <History className="h-3.5 w-3.5" />
            </button>
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400 dark:text-red-500" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Lock banner */}
        {locked && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800/30 flex items-center gap-2">
            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="text-[10px] font-sans text-amber-700 dark:text-amber-400 flex-1">
              This task is locked. Select a future date on the calendar to queue changes.
            </span>
            {hasLineage && (
              <button
                onClick={scrollToCalendar}
                className="text-[10px] font-bold font-sans px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors shrink-0"
              >
                Select Date
              </button>
            )}
          </div>
        )}

        {/* Two-column body */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row min-h-0">
          {/* Left column: task fields */}
          <div className="flex-1 min-w-0 overflow-y-auto md:border-r border-gray-100 dark:border-[#111124]">
            {/* Field rows */}
            <div className="px-4 py-3 space-y-2">
              {/* MM Sub-type chip selector */}
              {viewingTask.taskType === 'MM' && (
                <div className="flex items-center gap-1.5 pb-1">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 font-sans min-w-[90px] whitespace-nowrap">
                    Type
                  </span>
                  <div className="flex gap-1">
                    {MM_SUB_TYPES.map((st) => {
                      const active = (fields.type || '').toLowerCase() === st.toLowerCase();
                      return (
                        <button
                          key={st}
                          onClick={() => {
                            if (locked) return;
                            const currentFields = { ...serverFields, ...pendingChanges, type: st } as TaskFields;
                            onUpdate(viewingTask.id, { fields: currentFields });
                            setPendingChanges((prev) => {
                              const { type: _, ...rest } = prev;
                              return rest;
                            });
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans transition-all border"
                          style={{
                            background: active ? typeColor + '20' : 'transparent',
                            color: active ? typeColor : '#6b6b8a',
                            borderColor: active ? typeColor + '50' : '#1e1e38',
                            opacity: locked ? 0.6 : 1,
                          }}
                          disabled={locked}
                        >
                          <span>{MM_SUB_TYPE_ICONS[st]}</span>
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WP Sub-type chip selector */}
              {viewingTask.taskType === 'WP' && (
                <div className="flex items-center gap-1.5 pb-1">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 font-sans min-w-[90px] whitespace-nowrap">
                    Type
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {WP_SUB_TYPES.map((st) => {
                      const active = (fields.type || '').toLowerCase() === st.toLowerCase();
                      return (
                        <button
                          key={st}
                          onClick={() => {
                            if (locked) return;
                            const currentFields = { ...serverFields, ...pendingChanges, type: st } as TaskFields;
                            onUpdate(viewingTask.id, { fields: currentFields });
                            setPendingChanges((prev) => {
                              const { type: _, ...rest } = prev;
                              return rest;
                            });
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans transition-all border"
                          style={{
                            background: active ? typeColor + '20' : 'transparent',
                            color: active ? typeColor : '#6b6b8a',
                            borderColor: active ? typeColor + '50' : '#1e1e38',
                            opacity: locked ? 0.6 : 1,
                          }}
                          disabled={locked}
                        >
                          <span>{WP_SUB_TYPE_ICONS[st]}</span>
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {fieldDefs
                .filter((def) => def.key !== 'caption' || !TYPES_WITH_PICKER.has(viewingTask.taskType))
                .filter((def) => def.key !== 'type') // type rendered as chips above
                .filter((def) => def.key !== 'subType')
                .filter((def) => def.key !== 'finalAmount' || viewingTask.taskType === 'WP' || (fields.type || '').toLowerCase().includes('unlock'))
                .map((def) => {
                    const isLockedField = locked && def.key !== 'finalAmount';
                    const isCurrency = def.key === 'price' || def.key === 'finalAmount';
                    return (
                      <ModalFieldRow
                        key={def.key}
                        fieldKey={def.key}
                        label={def.label}
                        value={fields[def.key] || ''}
                        placeholder={def.placeholder}
                        onChange={(val) => handleFieldChange(def.key, val)}
                        disabled={isLockedField}
                        highlight={locked && def.key === 'finalAmount'}
                        currency={isCurrency}
                      />
                    );
                })}

              {/* Lifetime Earnings (unlock tasks with lineage) */}
              {hasFinalAmountField && hasLineage && (
                <div className="px-1 py-1.5">
                  {!showEarnings ? (
                    <button
                      onClick={() => setShowEarnings(true)}
                      className="flex items-center gap-1.5 text-[10px] font-bold font-sans px-2.5 py-1 rounded-md border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <TrendingUp className="h-3 w-3" />
                      Lifetime Earnings
                    </button>
                  ) : earningsQuery.isLoading ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  ) : earningsQuery.data ? (
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold font-sans uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          Lifetime Earnings
                        </span>
                        <button
                          onClick={() => setShowEarnings(false)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          ${earningsQuery.data.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                          {earningsQuery.data.filledCount}/{earningsQuery.data.taskCount} filled
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {fieldDefs.length === 0 && viewingTask.taskName && (
                <div className="text-xs font-mono text-gray-600 dark:text-gray-400 py-1">
                  {viewingTask.taskName}
                </div>
              )}
            </div>

            {/* Caption Picker Section */}
            {TYPES_WITH_PICKER.has(viewingTask.taskType) && (
              <div className="mx-4 mb-3 border rounded-lg overflow-hidden border-gray-200 dark:border-[#111124]">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-[#111124] bg-gray-50 dark:bg-[#090912]">
                  <span className="text-[11px] font-bold font-sans" style={{ color: typeColor }}>
                    Caption{fields.captionId && fields.flagged ? ' 🚩' : ''}
                  </span>
                  {/* Caption QA status indicator */}
                  {fields.captionQAStatus === 'sent_to_qa' && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Hourglass className="h-2.5 w-2.5" />
                      Pending QA Review
                    </span>
                  )}
                  {fields.captionQAStatus === 'approved' && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      QA Approved
                    </span>
                  )}
                  {fields.captionQAStatus === 'rejected' && (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                      <XCircle className="h-2.5 w-2.5" />
                      QA Rejected
                    </span>
                  )}
                </div>
                {/* Rejection reason banner */}
                {fields.captionQAStatus === 'rejected' && (
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/40 text-[10px] text-red-600 dark:text-red-400">
                    <span className="font-bold">Rejection reason:</span>{' '}
                    {(fields as Record<string, string>)._qaRejectionReason || 'No reason provided — please update the caption and save again.'}
                  </div>
                )}
                <div className="p-3">
                  <CaptionPicker
                    profileId={viewingTask.profileId}
                    captionCategory={getCaptionCategory(viewingTask.taskType, fields.type)}
                    selectedCaptionId={fields.captionId || null}
                    captionOverride={fields.captionId ? '' : (fields.caption || '')}
                    onSelectCaption={handleSelectCaption}
                    onClearCaption={handleClearCaption}
                    onOverrideChange={handleCaptionOverride}
                    typeColor={typeColor}
                  />
                </div>
              </div>
            )}

          </div>

          {/* Right column: preview + calendar + queue + history */}
          <div ref={calendarRef} className="w-full md:w-80 shrink-0 overflow-y-auto border-t md:border-t-0 border-gray-100 dark:border-[#111124]">
            <ContentPreview fields={fields} typeColor={typeColor} sextingSetItems={sextingSetPreview} sextingSetName={sextingSetName} selectedItemId={sextingSelectedItemId} onSelectItem={setSextingSelectedItemId} />
            <QueueCalendar
              task={task}
              schedulerToday={schedulerToday || ''}
              weekStart={weekStart || ''}
              typeColor={typeColor}
              queueTargetWeek={queueTargetWeek}
              onSelectQueueTarget={setQueueTargetWeek}
              onSelectTask={handleSelectLineageTask}
              activeTaskId={viewingTask.id}
              onDeleteTask={handleDeleteQueuedTask}
            />
          </div>
        </div>

        {/* Footer: action buttons + time info */}
        <div className="border-t border-gray-100 dark:border-[#111124]">
          {/* Action buttons row — always visible, disabled when not actionable */}
          <div className="px-4 py-2.5 flex items-center justify-end gap-2 border-b border-gray-100 dark:border-[#111124]">
            {/* Save button — label changes when caption change on flagged task will trigger QA */}
            {(() => {
              const captionWillChange = pendingChanges.caption !== undefined ||
                pendingChanges.captionBankText !== undefined ||
                pendingChanges.captionId !== undefined;
              const wasFlagged = serverFields.flagged === 'true' || serverFields.flagged === true as unknown as string;
              const alreadyInQA = !!serverFields.captionQAStatus;
              const willSendToQA = isDirty && captionWillChange && (wasFlagged || alreadyInQA);

              return (
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className={[
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold font-sans border transition-colors',
                    isDirty
                      ? willSendToQA
                        ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40 dark:hover:bg-amber-900/30'
                        : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40 dark:hover:bg-green-900/30'
                      : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed dark:bg-gray-900/20 dark:text-gray-600 dark:border-gray-800/40',
                  ].join(' ')}
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : willSendToQA ? <Send className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                  {willSendToQA ? 'Save & Send to QA' : 'Save'}
                </button>
              );
            })()}


            {/* Queue button — always visible, disabled when no target selected */}
            <button
              onClick={handleQueue}
              disabled={!queueTargetWeek || !hasLineage || queueMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold font-sans border transition-colors"
              style={{
                background: queueTargetWeek && hasLineage ? typeColor + '10' : undefined,
                color: queueTargetWeek && hasLineage ? typeColor : undefined,
                borderColor: queueTargetWeek && hasLineage ? typeColor + '40' : undefined,
                opacity: queueTargetWeek && hasLineage ? 1 : 0.4,
                cursor: queueTargetWeek && hasLineage ? 'pointer' : 'not-allowed',
              }}
            >
              {queueMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {queueTargetWeek ? (
                <>
                  Queue for {(() => {
                    const ws = new Date(queueTargetWeek + 'T00:00:00Z');
                    ws.setUTCDate(ws.getUTCDate() + task.dayOfWeek);
                    return !isNaN(ws.getTime())
                      ? ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                      : queueTargetWeek;
                  })()}
                </>
              ) : (
                'Queue'
              )}
            </button>
          </div>

          {/* Time info row */}
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {viewingTask.startTime && (
                <div className="flex items-center gap-1 text-[9px] font-mono text-gray-500 dark:text-gray-600">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTimeInTz(viewingTask.startTime, LA_TZ)}
                  {viewingTask.endTime && (
                    <>
                      <span>→</span>
                      <span>{formatTimeInTz(viewingTask.endTime, LA_TZ)}</span>
                      <span className="text-green-600 dark:text-[#4ade80]">
                        ({formatDuration(viewingTask.startTime, viewingTask.endTime)})
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            {viewingTask.updatedBy && (
              <span className="text-[8px] font-mono text-gray-400 dark:text-gray-700 truncate">
                updated by {viewingTask.updatedBy}
              </span>
            )}
            <TaskViewerBanner taskId={viewingTask.id} />
          </div>
        </div>
      </div>

      {/* Side panel: History or Lineage */}
      {showHistory && (
        <div
          className="w-80 shrink-0 rounded-r-xl border border-l-0 bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#1a1a2e] shadow-2xl flex flex-col overflow-hidden"
          style={{ borderTopWidth: 3, borderTopColor: sidePanel === 'lineage' ? '#10b981' : typeColor }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-[#111124]">
            <div className="flex items-center gap-1.5">
              {sidePanel === 'lineage' ? (
                <>
                  <GitBranch className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-bold tracking-wider font-sans text-gray-500 dark:text-gray-400">
                    LINEAGE TASKS
                  </span>
                </>
              ) : (
                <>
                  <History className="h-3 w-3 text-brand-blue" />
                  <span className="text-[10px] font-bold tracking-wider font-sans text-gray-500 dark:text-gray-400">
                    {task.lineageId ? 'LINEAGE HISTORY' : 'TASK HISTORY'}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => setSidePanel(null)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sidePanel === 'lineage' && task.lineageId ? (
              <ModalLineageTasks
                lineageId={task.lineageId}
                currentTaskId={viewingTask.id}
                onSelectTask={(t) => setViewingTask(t)}
                typeColor={typeColor}
              />
            ) : task.lineageId ? (
              <ModalLineageHistory lineageId={task.lineageId} />
            ) : (
              <ModalTaskHistory taskId={viewingTask.id} />
            )}
          </div>
        </div>
      )}
      </div>

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white dark:bg-[#0c0c1a] border border-gray-200 dark:border-[#1a1a2e] rounded-xl shadow-2xl p-5 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete task?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end mt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete!(viewingTask.id);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────


const MULTILINE_KEYS = new Set(['caption', 'captionGuide', 'paywallContent', 'contentPreview', 'contentFlyer']);

function ModalFieldRow({
  label,
  value,
  placeholder,
  onChange,
  disabled,
  highlight,
  currency,
  fieldKey,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  highlight?: boolean;
  currency?: boolean;
  fieldKey?: string;
}) {
  const multiline = fieldKey ? MULTILINE_KEYS.has(fieldKey) : false;
  // For currency fields, strip the $ prefix for local editing
  const toRaw = (v: string) => currency ? v.replace(/^\$/, '').trim() : v;
  const [localVal, setLocalVal] = useState(toRaw(value));

  useEffect(() => {
    setLocalVal(toRaw(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (currency) {
      const cleaned = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      setLocalVal(cleaned);
    } else {
      setLocalVal(e.target.value);
    }
  };

  const handleBlur = () => {
    if (currency) {
      const num = parseFloat(localVal);
      if (!localVal || isNaN(num)) {
        onChange('');
        setLocalVal('');
      } else {
        const formatted = `$${num.toFixed(2)}`;
        onChange(formatted);
        setLocalVal(num.toFixed(2));
      }
    } else {
      onChange(localVal);
    }
  };

  const inputClasses = `flex-1 text-xs py-1 rounded border outline-none font-mono transition-colors ${
    disabled
      ? 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed dark:bg-[#0c0c18] dark:border-[#1a1a2e] dark:text-gray-400'
      : highlight
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:border-emerald-500 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300 dark:focus:border-emerald-500'
        : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue dark:bg-[#090912] dark:border-[#1a1a2e] dark:text-gray-300 dark:focus:border-[#38bdf8]'
  }`;

  return (
    <div className={`flex ${multiline ? 'items-start' : 'items-center'} gap-3 transition-opacity ${disabled ? 'opacity-75' : ''}`}>
      <label className={`text-[10px] font-bold font-sans min-w-[90px] whitespace-nowrap ${multiline ? 'pt-1.5' : ''} ${highlight ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-600'}`}>
        {label}
      </label>
      {currency ? (
        <div className={`flex items-center ${inputClasses} px-0`}>
          <span className={`text-xs font-mono pl-2 pr-0.5 ${disabled ? 'text-gray-400 dark:text-gray-700' : highlight ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>$</span>
          <input
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="0.00"
            disabled={disabled}
            inputMode="decimal"
            className="flex-1 text-xs py-0 bg-transparent outline-none font-mono text-inherit pr-2"
          />
        </div>
      ) : multiline ? (
        <textarea
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={Math.max(2, Math.min(6, localVal.split('\n').length))}
          className={`${inputClasses} px-2 resize-none`}
        />
      ) : (
        <input
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputClasses} px-2`}
        />
      )}
    </div>
  );
}

const URL_REGEX = /^https?:\/\/.+/i;

/** Fullscreen image lightbox rendered via portal */
function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
      >
        <X className="h-5 w-5 text-white" />
      </button>
      <img
        src={url}
        alt="Full preview"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

/** Tries to render a URL as an image; falls back to a styled link card on error */
function PreviewMedia({
  url,
  label,
  typeColor,
  compact,
}: {
  url: string;
  label: string;
  typeColor: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  // Extract a readable short label from the URL
  const shortUrl = url.replace('https://', '').replace('http://', '');
  const domain = shortUrl.split('/')[0];
  const lastSegment = shortUrl.split('/').pop()?.split('?')[0] || domain;

  return (
    <div className={[compact ? 'shrink-0 w-16' : 'flex-1 min-w-0', 'flex flex-col h-full'].join(' ')}>
      <span className="text-[8px] font-bold font-sans text-gray-400 dark:text-gray-600 mb-1 shrink-0">
        {label}
      </span>
      {!failed ? (
        <div className="flex-1 min-h-0 relative">
          <img
            src={url}
            alt={label}
            className="w-full h-full object-contain rounded border border-gray-200 dark:border-gray-800 bg-black/5 dark:bg-black/20 cursor-zoom-in hover:opacity-80 transition-opacity"
            loading="lazy"
            onClick={() => setLightbox(true)}
            onError={() => setFailed(true)}
          />
          {lightbox && <ImageLightbox url={url} onClose={() => setLightbox(false)} />}
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 flex-1 min-h-0 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors p-2.5"
        >
          <span
            className="flex items-center justify-center h-8 w-8 rounded-md shrink-0 text-[10px] font-bold text-white"
            style={{ background: typeColor }}
          >
            ↗
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold font-sans text-gray-700 dark:text-gray-300 truncate">
              {lastSegment}
            </p>
            <p className="text-[8px] font-mono text-gray-400 dark:text-gray-600 truncate">
              {domain}
            </p>
          </div>
        </a>
      )}
    </div>
  );
}

function ContentPreview({
  fields,
  typeColor,
  sextingSetItems,
  sextingSetName,
  selectedItemId,
  onSelectItem,
}: {
  fields: Record<string, string>;
  typeColor: string;
  sextingSetItems?: CaptionSelection['sextingSetItems'] | null;
  sextingSetName?: string;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
}) {
  const contentVal = fields.contentPreview || fields.contentFlyer || '';
  const flyerUrl = fields.flyerAssetUrl || '';
  const setSelectedItemId = onSelectItem ?? (() => {});

  const hasContentUrl = URL_REGEX.test(contentVal);
  const hasFlyerUrl = URL_REGEX.test(flyerUrl);
  const hasAny = hasContentUrl || hasFlyerUrl;
  const hasSextingSet = sextingSetItems && sextingSetItems.length > 0;
  const selectedSetItem = hasSextingSet ? sextingSetItems.find((i) => i.id === selectedItemId) ?? null : null;

  return (
    <div className="p-3 border-b border-gray-100 dark:border-[#111124]">
      <span className="text-[9px] font-bold tracking-wider font-sans text-gray-400 block mb-2">PREVIEW</span>

      {/* Fixed-height container so layout never shifts */}
      <div className={hasSextingSet ? '' : 'h-36'}>
        {hasSextingSet ? (
          /* Sexting set preview: selected image or thumbnail grid */
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Images className="h-3 w-3" style={{ color: typeColor }} />
              <span className="text-[10px] font-bold font-sans" style={{ color: typeColor }}>
                {sextingSetName || 'Sexting Set'}
              </span>
              <span className="text-[8px] text-gray-500 font-mono">
                ({sextingSetItems.length} image{sextingSetItems.length !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Selected item full preview */}
            {selectedSetItem ? (
              <div>
                <div className="relative rounded-lg overflow-hidden border border-gray-800/50 bg-black/20 mb-1.5">
                  <img src={selectedSetItem.url} alt="" className="w-full h-auto max-h-44 object-contain bg-black/40" />
                  <button
                    onClick={() => setSelectedItemId(null)}
                    className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-black/60 hover:bg-black/80 text-gray-300 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-[9px] font-sans font-bold text-gray-400 mb-0.5">
                  {selectedSetItem.fileName || 'Image'}
                  {selectedSetItem.captionStatus === 'approved' && (
                    <span className="ml-1.5 text-[7px] px-1 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-bold">✓ Approved</span>
                  )}
                  {selectedSetItem.captionStatus === 'rejected' && (
                    <span className="ml-1.5 text-[7px] px-1 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold">✗ Rejected</span>
                  )}
                </div>
                {selectedSetItem.captionText && (
                  <div className="text-[9px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap mt-1 max-h-20 overflow-y-auto scrollbar-thin">
                    {selectedSetItem.captionText}
                  </div>
                )}
              </div>
            ) : (
              /* Thumbnail grid with captions — click to preview */
              <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto scrollbar-thin pr-0.5">
                {sextingSetItems.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className="cursor-pointer rounded-lg overflow-hidden border border-gray-800/50 bg-black/10 hover:border-gray-600 transition-colors group"
                  >
                    <div className="relative aspect-square">
                      <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">#{idx + 1}</span>
                      </div>
                      {item.captionStatus === 'approved' && (
                        <span className="absolute top-0.5 right-0.5 text-[6px] px-0.5 rounded-full bg-green-500/80 text-white font-bold">✓</span>
                      )}
                      {item.captionStatus === 'rejected' && (
                        <span className="absolute top-0.5 right-0.5 text-[6px] px-0.5 rounded-full bg-red-500/80 text-white font-bold">✗</span>
                      )}
                    </div>
                    {item.captionText ? (
                      <div className="px-1.5 py-1 bg-black/20">
                        <p className="text-[8px] font-mono text-gray-400 leading-snug line-clamp-2 whitespace-pre-wrap">
                          {item.captionText}
                        </p>
                      </div>
                    ) : (
                      <div className="px-1.5 py-1 bg-black/20">
                        <span className="text-[8px] font-mono text-gray-600 italic">No caption</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center h-full rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02] gap-1.5">
            {fields.captionId ? (
              <>
                <span className="text-[10px] font-sans font-bold text-amber-500">
                  No GIF available
                </span>
                <span className="text-[8px] font-mono text-gray-400 dark:text-gray-600 text-center px-4">
                  Caption selected but GIF hasn&apos;t been created yet.
                  Paste a URL in Content/Preview or wait for the GIF team.
                </span>
              </>
            ) : (
              <span className="text-[10px] font-mono text-gray-300 dark:text-gray-700">
                No preview or flyer available
              </span>
            )}
          </div>
        ) : (
          <div className="flex gap-2 h-full">
            {hasContentUrl && (
              <PreviewMedia
                url={contentVal}
                label={fields.contentPreview ? 'Content' : 'Flyer'}
                typeColor={typeColor}
              />
            )}
           
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History field labels ────────────────────────────────────────────────────

const HISTORY_FIELD_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = { status: 'Status', taskType: 'Type', taskName: 'Task Name', notes: 'Notes', sortOrder: 'Sort Order' };
  for (const [, defs] of Object.entries(TASK_FIELD_DEFS)) {
    for (const d of defs) map[`fields.${d.key}`] = d.label;
  }
  return map;
})();

function historyLabel(field: string) { return HISTORY_FIELD_LABELS[field] || field.replace('fields.', ''); }
function truncHist(val: string | null, max = 50) { return !val ? '(empty)' : val.length > max ? val.slice(0, max) + '...' : val; }

const STATUS_BADGE_MAP: Record<string, string> = { PENDING: '#3a3a5a', IN_PROGRESS: '#38bdf8', DONE: '#4ade80', SKIPPED: '#fbbf24' };

function HistBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">(empty)</span>;
  const c = STATUS_BADGE_MAP[value] || '#888';
  return <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ background: c + '20', color: c }}>{value}</span>;
}

// ─── Task History Panel (for sidebar) ────────────────────────────────────────

function ModalTaskHistory({ taskId }: { taskId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTaskHistory(taskId);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-brand-blue" /></div>;
  if (items.length === 0) return <p className="text-[10px] text-center py-10 font-mono text-gray-400">No changes recorded yet.</p>;

  return (
    <div>
      {items.map((item) => (
        <HistoryRow key={item.id} item={item} />
      ))}
      {hasNextPage && (
        <div className="px-3 py-2 text-center">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="text-[10px] font-bold font-sans text-brand-blue">
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: TaskHistoryItem }) {
  const isStatus = item.field === 'status';
  return (
    <div className="px-3 py-2 border-b border-gray-50 dark:border-[#0c0c1f] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-2">
        {item.user.imageUrl ? (
          <img src={item.user.imageUrl} alt="" className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
        ) : (
          <div className="h-4 w-4 rounded-full shrink-0 mt-0.5 bg-brand-light-pink/10" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-mono text-gray-500 dark:text-gray-500">
            <span className="font-bold text-gray-700 dark:text-gray-300">{item.user.name || 'Unknown'}</span>
            {' '}{item.action === 'QUEUED' ? 'queued' : 'changed'}{' '}
            <span className="font-bold">{historyLabel(item.field)}</span>
          </p>
          <div className="flex items-center gap-1 mt-0.5 text-[8px] font-mono flex-wrap">
            {isStatus ? (
              <><HistBadge value={item.oldValue} /><span className="text-gray-400">→</span><HistBadge value={item.newValue} /></>
            ) : (
              <><span className="text-red-400 line-through">{truncHist(item.oldValue)}</span><span className="text-gray-400">→</span><span className="text-green-500">{truncHist(item.newValue)}</span></>
            )}
          </div>
          <p className="text-[7px] mt-0.5 font-mono text-gray-300 dark:text-gray-700">
            {new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Lineage History Panel (for sidebar) ─────────────────────────────────────

function ModalLineageTasks({
  lineageId,
  currentTaskId,
  onSelectTask,
  typeColor,
}: {
  lineageId: string;
  currentTaskId: string;
  onSelectTask: (task: SchedulerTask) => void;
  typeColor: string;
}) {
  const { data, isLoading } = useTaskLineage(lineageId);
  const tasks = data?.tasks ?? [];

  // Compute total earnings
  const { total, filledCount } = React.useMemo(() => {
    let sum = 0;
    let filled = 0;
    for (const t of tasks) {
      const f = (t.fields || {}) as Record<string, string>;
      const raw = f.finalAmount || '';
      if (raw) {
        const parsed = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
        if (!isNaN(parsed)) { sum += parsed; filled++; }
      }
    }
    return { total: Math.round(sum * 100) / 100, filledCount: filled };
  }, [tasks]);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-emerald-500" /></div>;
  if (tasks.length === 0) return <p className="text-[10px] text-center py-10 font-mono text-gray-400">No lineage tasks found.</p>;

  return (
    <div>
      {/* Earnings summary */}
      <div className="px-3 py-2.5 border-b border-gray-100 dark:border-[#111124] bg-emerald-500/5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-bold font-sans text-emerald-600 dark:text-emerald-400">
            Total Earnings
          </span>
          <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
            {filledCount}/{tasks.length} filled
          </span>
        </div>
        <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Task list */}
      {tasks.map((t) => {
        const f = (t.fields || {}) as Record<string, string>;
        const ws = new Date(t.weekStartDate);
        const d = new Date(ws);
        d.setUTCDate(d.getUTCDate() + t.dayOfWeek);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const amount = f.finalAmount || '';
        const isCurrent = t.id === currentTaskId;
        const typeName = f.type || t.taskName || '';
        const isFlagged = f.flagged === 'true' || f.flagged === (true as unknown as string);

        return (
          <button
            key={t.id}
            onClick={() => onSelectTask(t)}
            className={[
              'w-full text-left px-3 py-2 border-b border-gray-50 dark:border-[#0c0c1f] transition-colors',
              isCurrent
                ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                : 'hover:bg-gray-50 dark:hover:bg-white/[0.02] border-l-2 border-l-transparent',
            ].join(' ')}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-mono font-bold text-gray-700 dark:text-gray-300">
                {dateStr}
              </span>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: (
                    t.status === 'DONE' ? '#4ade80' :
                    t.status === 'IN_PROGRESS' ? '#38bdf8' :
                    t.status === 'SKIPPED' ? '#fbbf24' : '#6b7280'
                  ) + '18',
                  color:
                    t.status === 'DONE' ? '#4ade80' :
                    t.status === 'IN_PROGRESS' ? '#38bdf8' :
                    t.status === 'SKIPPED' ? '#fbbf24' : '#6b7280',
                }}
              >
                {t.status}
              </span>
            </div>
            {typeName && (
              <p className="text-[9px] font-sans text-gray-500 dark:text-gray-400 truncate mb-0.5">
                {typeName}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold font-mono ${amount ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-700'}`}>
                {amount ? `${amount}` : '—'}
              </span>
              <div className="flex items-center gap-1">
                {isFlagged && (
                  <Flag className="h-2.5 w-2.5 text-amber-500" fill="currentColor" />
                )}
                {isCurrent && (
                  <span className="text-[7px] font-bold font-sans uppercase text-emerald-500">Current</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ModalLineageHistory({ lineageId }: { lineageId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useLineageHistory(lineageId);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-brand-blue" /></div>;
  if (items.length === 0) return <p className="text-[10px] text-center py-10 font-mono text-gray-400">No changes recorded across this lineage.</p>;

  return (
    <div>
      {items.map((item) => (
        <LineageHistoryRow key={item.id} item={item} />
      ))}
      {hasNextPage && (
        <div className="px-3 py-2 text-center">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="text-[10px] font-bold font-sans text-brand-blue">
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

function LineageHistoryRow({ item }: { item: LineageHistoryItem }) {
  const isStatus = item.field === 'status';
  return (
    <div className="px-3 py-2 border-b border-gray-50 dark:border-[#0c0c1f] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-2">
        {item.user.imageUrl ? (
          <img src={item.user.imageUrl} alt="" className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
        ) : (
          <div className="h-4 w-4 rounded-full shrink-0 mt-0.5 bg-brand-light-pink/10" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[9px] font-mono text-gray-500 dark:text-gray-500">
              <span className="font-bold text-gray-700 dark:text-gray-300">{item.user.name || 'Unknown'}</span>
              {' '}{item.action === 'QUEUED' ? 'queued' : 'changed'}{' '}
              <span className="font-bold">{historyLabel(item.field)}</span>
            </p>
            {item.weekStartDate && (
              <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
                {new Date(item.weekStartDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[8px] font-mono flex-wrap">
            {isStatus ? (
              <><HistBadge value={item.oldValue} /><span className="text-gray-400">→</span><HistBadge value={item.newValue} /></>
            ) : (
              <><span className="text-red-400 line-through">{truncHist(item.oldValue)}</span><span className="text-gray-400">→</span><span className="text-green-500">{truncHist(item.newValue)}</span></>
            )}
          </div>
          <p className="text-[7px] mt-0.5 font-mono text-gray-300 dark:text-gray-700">
            {new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
