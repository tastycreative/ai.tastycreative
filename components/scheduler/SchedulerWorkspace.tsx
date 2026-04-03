'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Flag, DollarSign, AlertCircle, Loader2, Search, Clock, Eye, ChevronDown, ChevronUp, Check, X, TrendingUp, ImageOff, Lock, Send, AlertTriangle, Info, Link2, CheckCircle2 } from 'lucide-react';
import {
  useWorkspaceTasks,
  SchedulerTask,
  useUpdatePodTask,
  useMergeTaskFields,
  useLineageEarnings,
  useQueueTaskUpdate,
  useSiblingTask,
  isTaskLocked,
  TASK_FIELD_DEFS,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS, TaskViewerAvatars, TaskViewerBanner } from './task-cards/shared';
import { useSchedulerPresenceContext } from './SchedulerPresenceContext';
import { SchedulerTaskModal } from './SchedulerTaskModal';
import { QueueCalendar } from './QueueCalendar';
import { CaptionPicker, type CaptionSelection } from './pickers/CaptionPicker';
import { useFieldReview } from '@/lib/hooks/useFieldReview';
import { tabId } from '@/lib/hooks/useSchedulerRealtime';
import { toast } from 'sonner';
import { useInstagramProfile } from '@/lib/hooks/useInstagramProfile.query';

// ─── Caption helpers (shared with modal) ──────────────────────────────────────

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
const URL_REGEX = /^https?:\/\/.+/i;

// ─── Constants ───────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#6b7280',
  IN_PROGRESS: '#38bdf8',
  DONE: '#4ade80',
  SKIPPED: '#fbbf24',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  SKIPPED: 'Skipped',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTaskLabel(task: SchedulerTask): string {
  const f = (task.fields || {}) as Record<string, string>;
  switch (task.taskType) {
    case 'MM': return f.type || task.taskName || '';
    case 'WP': return f.postSchedule || f.type || task.taskName || '';
    case 'ST': return task.taskName || '';
    case 'SP': return f.subscriberPromoSchedule || f.type || task.taskName || '';
    default: return task.taskName || '';
  }
}

function getTaskTime(task: SchedulerTask): string {
  const f = (task.fields || {}) as Record<string, string>;
  if (task.taskType === 'ST') return f.storyPostSchedule || '';
  return f.time || '';
}

function getTaskDate(task: SchedulerTask): string {
  const ws = new Date(task.weekStartDate);
  const d = new Date(ws);
  d.setUTCDate(d.getUTCDate() + task.dayOfWeek);
  return d.toISOString().split('T')[0];
}

function formatTaskDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ─── Queue Item ──────────────────────────────────────────────────────────────

function QueueItem({
  task,
  isSelected,
  onSelect,
  activeTab,
  schedulerToday,
}: {
  task: SchedulerTask;
  isSelected: boolean;
  onSelect: () => void;
  activeTab: 'flagged' | 'missing-amount';
  schedulerToday: string;
}) {
  const fields = (task.fields || {}) as Record<string, string>;
  const typeColor = TASK_TYPE_COLORS[task.taskType] || '#888';
  const label = getTaskLabel(task);
  const time = getTaskTime(task);
  const taskDate = getTaskDate(task);
  const locked = isTaskLocked(task, schedulerToday);
  const accentColor = activeTab === 'flagged' ? 'border-amber-500' : 'border-rose-500';

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 transition-all border-l-2 ${
        isSelected
          ? `${accentColor} bg-white dark:bg-gray-800/50`
          : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[8px] font-bold font-sans px-1.5 py-0.5 rounded"
          style={{ background: typeColor + '18', color: typeColor }}
        >
          {task.taskType}
        </span>
        <span
          className="text-[8px] font-bold font-sans uppercase"
          style={{ color: PLATFORM_COLORS[task.platform] || '#888' }}
        >
          {PLATFORM_LABELS[task.platform] || task.platform}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <TaskViewerAvatars taskId={task.id} size="sm" />
          {locked && activeTab === 'flagged' && <Lock className="h-2.5 w-2.5 text-gray-400 dark:text-gray-600" />}
          <span className="text-[8px] font-mono text-gray-400 dark:text-gray-500">
            {formatTaskDate(taskDate)}
          </span>
        </div>
      </div>
      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
        {label || 'Untitled task'}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <div
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLORS[task.status] || '#888' }}
        />
        <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">
          {STATUS_LABELS[task.status] || task.status}
        </span>
        {fields.subType && (
          <>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="text-[9px] font-sans font-semibold" style={{ color: typeColor }}>
              {fields.subType}
            </span>
          </>
        )}
        {time && (
          <>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="text-[9px] font-mono text-gray-400 dark:text-gray-500">{time}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function TaskDetailPanel({
  task,
  activeTab,
  onOpenModal,
  onSaveField,
  onUnflag,
  onTaskUpdate,
  isSaving,
  schedulerToday,
  weekStart,
  profileName,
}: {
  task: SchedulerTask;
  activeTab: 'flagged' | 'missing-amount';
  onOpenModal: () => void;
  onSaveField: (taskId: string, fieldPatch: Record<string, string>) => void;
  onUnflag: (taskId: string) => void;
  onTaskUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  isSaving: boolean;
  schedulerToday: string;
  weekStart?: string;
  profileName?: string;
}) {
  const serverFields = (task.fields || {}) as Record<string, string>;
  const typeColor = TASK_TYPE_COLORS[task.taskType] || '#888';
  const label = getTaskLabel(task);
  const time = getTaskTime(task);
  const taskDate = getTaskDate(task);
  const isFlagged = serverFields.flagged === 'true' || serverFields.flagged === (true as unknown as string);
  const isMissingAmountTab = activeTab === 'missing-amount';
  const locked = !isMissingAmountTab && isTaskLocked(task, schedulerToday);

  // Local editable field state — tracks pending inline edits
  const [localFields, setLocalFields] = useState<Record<string, string>>({});
  const fields = { ...serverFields, ...localFields };

  // ─── Field review confirmation (gates QA send after caption/paywall changes) ───
  const fieldReview = useFieldReview();

  const previewUrl = fields.contentPreview || fields.contentFlyer || '';
  const caption = fields.captionBankText || fields.caption || '';
  const price = fields.price || '';
  const finalAmount = fields.finalAmount || '';

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountValue, setAmountValue] = useState(finalAmount);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  // Queue state (for locked tasks)
  const [queueTargetWeek, setQueueTargetWeek] = useState<string | null>(null);
  const queueMutation = useQueueTaskUpdate();

  // Detect follow-up type → fetch sibling unlock task
  const typeName = (serverFields.type || task.taskName || '').toLowerCase();
  const isFollowUp = task.taskType === 'MM' &&
    (typeName.includes('follow up') || typeName.includes('follow-up'));
  const { data: siblingData } = useSiblingTask(isFollowUp ? task.id : null);
  const unlockSibling = siblingData?.sibling ?? null;


  const [showSiblingModal, setShowSiblingModal] = useState(false);

  // Lineage earnings — on-demand
  const hasFinalAmountField = task.taskType === 'WP' ||
    (fields.type || task.taskName || '').toLowerCase().includes('unlock');
  const hasLineage = !!task.lineageId;
  const [showEarnings, setShowEarnings] = useState(false);
  const earningsQuery = useLineageEarnings(task.lineageId, showEarnings && hasFinalAmountField && hasLineage);

  // Track if there are unsaved changes (for save indicator)
  const hasPendingChanges = Object.keys(localFields).some(
    (k) => localFields[k] !== (serverFields[k] || ''),
  );

  // Reset state when task changes
  useEffect(() => {
    setShowEarnings(false);
    setLocalFields({});
    setAmountValue(serverFields.finalAmount || '');
    setEditingAmount(false);
    setPreviewFailed(false);
    setQueueTargetWeek(null);
    setShowSiblingModal(false);
    fieldReview.resetReview();
  }, [task.id, serverFields.finalAmount, fieldReview]);

  // Handle queue
  const handleQueue = useCallback(() => {
    if (!queueTargetWeek) return;
    const currentFields = { ...serverFields, ...localFields } as Record<string, string>;
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
          setLocalFields({});
          // Auto-unflag the original task after successful queue
          onUnflag(task.id);
        },
      },
    );
  }, [queueTargetWeek, serverFields, localFields, task.id, task.dayOfWeek, queueMutation, onUnflag]);

  // Field defs for this task type (editable rows)
  const fieldDefs = TASK_FIELD_DEFS[task.taskType] || [];

  // Editable field rows (skip caption — handled by picker, skip type — shown in header)
  // Hide finalAmount on flagged tab since it's not relevant there
  const editableFields = useMemo(() => {
    return fieldDefs
      .filter((def) => def.key !== 'caption')
      .filter((def) => def.key !== 'type')
      .filter((def) => def.key !== 'subType')
      .filter((def) => def.key !== 'finalAmount' || (isMissingAmountTab && (task.taskType === 'WP' || (fields.type || '').toLowerCase().includes('unlock'))));
  }, [fieldDefs, task.taskType, fields.type, isMissingAmountTab]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setLocalFields((prev) => ({ ...prev, [key]: value }));
    // Activate review when paywallContent changes manually (and no review is active yet) — only on flagged tasks
    if (key === 'paywallContent' && !fieldReview.isReviewActive && isFlagged) {
      fieldReview.activateReview('paywallContent', fieldDefs.map((d) => d.key));
    }
    // Auto-confirm a field when it's edited
    if (fieldReview.needsReview(key)) {
      fieldReview.confirmField(key);
    }
  }, [fieldReview]);

  const handleSave = useCallback(() => {
    // Collect all changed fields
    const patch: Record<string, string> = {};
    for (const k of Object.keys(localFields)) {
      if (localFields[k] !== (serverFields[k] || '')) {
        patch[k] = localFields[k];
      }
    }

    // Detect caption change → send to QA if flagged or already in QA flow, AND all fields confirmed
    const captionChanged = patch.caption !== undefined ||
                           patch.captionBankText !== undefined ||
                           patch.captionId !== undefined;
    const isFlaggedNow = serverFields.flagged === 'true' || serverFields.flagged === true as unknown as string;
    const alreadyInQA = !!serverFields.captionQAStatus;
    const shouldSendToQA = captionChanged && (isFlaggedNow || alreadyInQA) && fieldReview.canSendToQA;

    if (shouldSendToQA) {
      patch.captionQAStatus = 'sent_to_qa';
      patch.flagged = '';
      if (!serverFields._previousCaption) {
        const prevCaption = serverFields.captionBankText || serverFields.caption || '';
        if (prevCaption) patch._previousCaption = prevCaption;
      }
      // For follow-up tasks, include the sibling unlock's paywallContent
      if (isFollowUp && unlockSibling) {
        const unlockFields = (unlockSibling.fields || {}) as Record<string, string>;
        if (unlockFields.paywallContent) {
          patch._unlockPaywallContent = unlockFields.paywallContent;
        }
      }
    }

    // Locked task → queue to future date + unflag original
    if (locked && queueTargetWeek) {
      const queueFields = { ...serverFields, ...patch };
      queueMutation.mutate(
        {
          sourceTaskId: task.id,
          weekStart: queueTargetWeek,
          dayOfWeek: task.dayOfWeek,
          fields: queueFields,
        },
        {
          onSuccess: () => {
            setQueueTargetWeek(null);
            setLocalFields({});
            // Unflag the original locked task
            onUnflag(task.id);
            if (shouldSendToQA) {
              toast.info('Caption queued & sent to QA for review', { duration: 4000 });
            } else {
              toast.success('Task queued to future date', { duration: 3000 });
            }
          },
        },
      );
      return;
    }

    // Normal (non-locked) save
    if (Object.keys(patch).length === 0) return;
    onSaveField(task.id, patch);
    setLocalFields({});
    fieldReview.resetReview();

    if (shouldSendToQA) {
      toast.info('Caption sent to QA for review', { duration: 4000 });
    }
  }, [localFields, serverFields, task.id, locked, queueTargetWeek, queueMutation, onSaveField, onUnflag, isFollowUp, unlockSibling, fieldReview]);

  // Caption picker handlers — no auto-save, only set local state
  const handleSelectCaption = useCallback((sel: CaptionSelection) => {
    const patch: Record<string, string> = {
      captionId: sel.captionId,
      captionBankText: sel.captionText,
      caption: sel.captionText,
      flyerAssetUrl: sel.gifUrl,
      flyerAssetId: sel.boardItemId || '',
    };
    if (sel.contentCount) {
      patch.paywallContent = sel.contentCount + (sel.contentLength ? ` (${sel.contentLength})` : '');
    }
    if (sel.price > 0) {
      patch.price = `$${sel.price.toFixed(2)}`;
    }
    if (sel.contentType) {
      patch.tag = sel.contentType;
    }
    setLocalFields((prev) => ({ ...prev, ...patch }));

    // Caption is the trigger → activate review for other fields (only on flagged tasks)
    // If paywallContent was the trigger → selecting a caption auto-confirms the caption field
    if (fieldReview.trigger === 'paywallContent') {
      fieldReview.confirmField('caption');
    } else if (isFlagged) {
      fieldReview.activateReview('caption', fieldDefs.map((d) => d.key));
    }
  }, [fieldReview, fieldDefs, isFlagged]);

  const handleClearCaption = useCallback(() => {
    setLocalFields((prev) => ({ ...prev, captionId: '', captionBankText: '' }));
  }, []);

  const handleCaptionOverride = useCallback((text: string) => {
    const patch = { caption: text, captionId: '', captionBankText: '' };
    setLocalFields((prev) => ({ ...prev, ...patch }));
    // If paywallContent was the trigger → typing caption auto-confirms it
    if (fieldReview.trigger === 'paywallContent') {
      fieldReview.confirmField('caption');
    } else if (!fieldReview.isReviewActive && isFlagged) {
      fieldReview.activateReview('caption', fieldDefs.map((d) => d.key));
    }
  }, [fieldReview, fieldDefs, isFlagged]);

  const accentBorder = activeTab === 'flagged' ? 'border-amber-500/30' : 'border-rose-500/30';
  const hasPreviewUrl = URL_REGEX.test(previewUrl);

  return (
    <>
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5">
      {/* Task header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="text-xs font-bold font-sans px-2 py-0.5 rounded-lg"
              style={{ background: typeColor + '18', color: typeColor, border: `1px solid ${typeColor}30` }}
            >
              {task.taskType}
            </span>
            <span
              className="text-xs font-bold font-sans px-2 py-0.5 rounded-lg"
              style={{
                background: (STATUS_COLORS[task.status] || '#888') + '18',
                color: STATUS_COLORS[task.status] || '#888',
              }}
            >
              {STATUS_LABELS[task.status] || task.status}
            </span>
            <span
              className="text-[10px] font-bold font-sans uppercase px-2 py-0.5 rounded-lg"
              style={{
                background: (PLATFORM_COLORS[task.platform] || '#888') + '18',
                color: PLATFORM_COLORS[task.platform] || '#888',
              }}
            >
              {PLATFORM_LABELS[task.platform] || task.platform}
            </span>
            {isFlagged && (
              <span className="text-[10px] font-bold font-sans px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30">
                Flagged
              </span>
            )}
            {locked && !isMissingAmountTab && (
              <span className="flex items-center gap-1 text-[10px] font-bold font-sans px-2 py-0.5 rounded-lg bg-gray-500/15 text-gray-500 border border-gray-500/30">
                <Lock className="h-2.5 w-2.5" />
                Locked
              </span>
            )}
            <TaskViewerBanner taskId={task.id} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {label || 'Untitled task'}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-mono">{formatTaskDate(taskDate)}</span>
            {time && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-mono">{time}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onOpenModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
        >
          <Eye className="h-3.5 w-3.5" />
          Open
        </button>
      </div>

      {/* Locked banner */}
      {locked && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-sans">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>This task&apos;s date has passed. Select a future date below to queue &amp; send to QA.</span>
        </div>
      )}

      {/* Content preview — always shown */}
      <div className={`rounded-xl overflow-hidden border ${accentBorder} mb-4`}>
        {hasPreviewUrl && !previewFailed ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Content preview"
            className="w-full max-h-[300px] object-contain bg-gray-50 dark:bg-gray-900"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-36 bg-gray-50 dark:bg-gray-900/50 gap-1.5">
            <ImageOff className="h-6 w-6 text-gray-300 dark:text-gray-700" />
            <span className="text-[10px] font-mono text-gray-300 dark:text-gray-700">
              No preview available
            </span>
          </div>
        )}
      </div>

      {/* Field review banner */}
      {fieldReview.isReviewActive && (
        <div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-sans ${
          fieldReview.canSendToQA
            ? 'bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-800/40 text-green-700 dark:text-green-400'
            : 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-800/40 text-amber-700 dark:text-amber-400'
        }`}>
          {fieldReview.canSendToQA ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>All fields confirmed. Ready for QA.</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {fieldReview.trigger === 'caption' ? 'Caption' : 'Paywall content'} changed &mdash; {fieldReview.unconfirmedFields.length} field{fieldReview.unconfirmedFields.length !== 1 ? 's' : ''} need{fieldReview.unconfirmedFields.length === 1 ? 's' : ''} review before sending to QA
              </span>
            </>
          )}
        </div>
      )}

      {/* Editable field rows */}
      <div className="mb-4 space-y-1.5">
        <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
          Details
        </div>
        {editableFields.map((def) => {
          const isCurrency = def.key === 'price' || def.key === 'finalAmount';
          // Missing-amount tab: only finalAmount & folderName editable; Flagged+locked: all fields editable
          const isDisabled = def.key !== 'finalAmount' && def.key !== 'folderName' && isMissingAmountTab;
          return (
            <WorkspaceFieldRow
              key={def.key}
              fieldKey={def.key}
              label={def.label}
              value={fields[def.key] || ''}
              placeholder={def.placeholder}
              currency={isCurrency}
              highlight={def.key === 'finalAmount' && !finalAmount}
              disabled={isDisabled}
              onChange={(val) => handleFieldChange(def.key, val)}
              needsReview={fieldReview.needsReview(def.key)}
              onMarkAsSame={fieldReview.needsReview(def.key) ? () => fieldReview.confirmField(def.key) : undefined}
            />
          );
        })}
      </div>

      {/* Lifetime Earnings (unlock tasks with lineage only) */}
      {hasFinalAmountField && hasLineage && (
        <div className="mb-4">
          {!showEarnings ? (
            <button
              onClick={() => setShowEarnings(true)}
              className="flex items-center gap-1.5 text-[10px] font-bold font-sans px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              View Lifetime Earnings
            </button>
          ) : earningsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading earnings...
            </div>
          ) : earningsQuery.data ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Lifetime Earnings
                </div>
                <button
                  onClick={() => setShowEarnings(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  ${earningsQuery.data.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                  {earningsQuery.data.filledCount}/{earningsQuery.data.taskCount} weeks filled
                </span>
              </div>
              {earningsQuery.data.items.length > 0 && (
                <div className="mt-2 space-y-0.5 max-h-[120px] overflow-y-auto">
                  {earningsQuery.data.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-gray-500 dark:text-gray-400">{item.date}</span>
                      <span className={item.finalAmount ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-600'}>
                        {item.finalAmount ? `$${item.finalAmount}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Follow-up hint — links to sibling Unlock task */}
      {isFollowUp && unlockSibling && (
        <button
          onClick={() => setShowSiblingModal(true)}
          className="w-full mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-50 dark:bg-pink-900/10 border border-pink-500/20 text-pink-700 dark:text-pink-400 text-[11px] font-sans hover:bg-pink-100 dark:hover:bg-pink-900/20 transition-colors text-left"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span>This is a <strong>follow-up</strong> to an Unlock task — click to view the Unlock</span>
        </button>
      )}

      {/* Caption Picker — hidden on missing-amount tab only */}
      {TYPES_WITH_PICKER.has(task.taskType) && !isMissingAmountTab && (
        <div className="mb-4">
          <div className={`flex items-center gap-2 text-[10px] font-bold font-sans uppercase tracking-wider mb-1.5 ${
            fieldReview.needsReview('caption') ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
          }`}>
            <span>Caption{fields.captionId && isFlagged ? ' 🚩' : ''}</span>
            {fieldReview.needsReview('caption') && (
              <button
                onClick={() => fieldReview.confirmField('caption')}
                className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                title="Mark as same"
              >
                <Check className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          <div className={`rounded-lg border p-3 ${
            fieldReview.needsReview('caption')
              ? 'border-amber-300 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10'
              : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'
          }`}>
            <CaptionPicker
              profileId={task.profileId}
              captionCategory={getCaptionCategory(task.taskType, fields.type)}
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

      {/* ── Queue date picker for locked tasks ── */}
      {locked && (
        <div className="mb-4">
          <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Queue to Future Date {!queueTargetWeek && <span className="text-amber-500">(required)</span>}
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <QueueCalendar
              task={task}
              schedulerToday={schedulerToday}
              weekStart={task.weekStartDate?.toString().split('T')[0] || schedulerToday}
              typeColor={typeColor}
              queueTargetWeek={queueTargetWeek}
              onSelectQueueTarget={setQueueTargetWeek}
            />
          </div>
          {queueTargetWeek && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              <Check className="h-3 w-3" />
              Queued for{' '}
              {(() => {
                const ws = new Date(queueTargetWeek + 'T00:00:00Z');
                ws.setUTCDate(ws.getUTCDate() + task.dayOfWeek);
                return !isNaN(ws.getTime())
                  ? ws.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
                  : queueTargetWeek;
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Save button ── */}
      {(() => {
        const captionChanged = localFields.caption !== undefined ||
                               localFields.captionBankText !== undefined ||
                               localFields.captionId !== undefined;
        const alreadyInQA = !!serverFields.captionQAStatus;
        const wantsSendToQA = captionChanged && (isFlagged || alreadyInQA);
        const blockedByReview = wantsSendToQA && !fieldReview.canSendToQA;
        const willSendToQA = wantsSendToQA && fieldReview.canSendToQA;
        const isQueuing = queueMutation.isPending;
        const needsQueueDate = locked && !queueTargetWeek;
        const isDisabled = locked
          ? needsQueueDate || (!hasPendingChanges && !queueTargetWeek) || isQueuing || isSaving
          : !hasPendingChanges || isSaving;

        // Button label
        let btnLabel = 'Saved';
        if (isQueuing) btnLabel = 'Queuing...';
        else if (isSaving) btnLabel = 'Saving...';
        else if (locked && needsQueueDate) btnLabel = 'Select a queue date first';
        else if (locked && willSendToQA) btnLabel = 'Queue & Send to QA';
        else if (locked && queueTargetWeek) btnLabel = 'Queue & Save';
        else if (willSendToQA) btnLabel = 'Save & Send to QA';
        else if (hasPendingChanges) btnLabel = 'Save Changes';

        const isActive = !isDisabled;
        const isQAStyle = isActive && (willSendToQA || locked) && !blockedByReview;

        return (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleSave}
              disabled={isDisabled}
              className={[
                'w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold font-sans border transition-colors',
                isActive
                  ? isQAStyle
                    ? 'bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40 dark:hover:bg-amber-900/30'
                    : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40 dark:hover:bg-green-900/30'
                  : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed dark:bg-gray-900/20 dark:text-gray-600 dark:border-gray-800/40',
              ].join(' ')}
            >
              {isQueuing || isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isQAStyle && isActive ? (
                <Send className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              {btnLabel}
            </button>
            {blockedByReview && (
              <span className="text-[9px] text-amber-500 dark:text-amber-400 font-sans text-center">
                Confirm {fieldReview.unconfirmedFields.length} field{fieldReview.unconfirmedFields.length !== 1 ? 's' : ''} to send to QA
              </span>
            )}
          </div>
        );
      })()}
    </div>

    {/* Sibling Unlock modal for follow-up tasks */}
    {unlockSibling && (
      <SchedulerTaskModal
        task={unlockSibling}
        open={showSiblingModal}
        onClose={() => setShowSiblingModal(false)}
        onUpdate={onTaskUpdate}
        schedulerToday={schedulerToday}
        weekStart={unlockSibling.weekStartDate?.toString().split('T')[0] || weekStart}
        profileName={profileName}
      />
    )}
    </>
  );
}

// ─── Editable Field Row ─────────────────────────────────────────────────────

const WS_MULTILINE_KEYS = new Set(['caption', 'captionGuide', 'paywallContent', 'contentPreview', 'contentFlyer']);

function WorkspaceFieldRow({
  label,
  value,
  placeholder,
  currency,
  highlight,
  fieldKey,
  disabled,
  onChange,
  needsReview,
  onMarkAsSame,
}: {
  label: string;
  value: string;
  placeholder?: string;
  currency?: boolean;
  highlight?: boolean;
  fieldKey?: string;
  disabled?: boolean;
  onChange: (val: string) => void;
  needsReview?: boolean;
  onMarkAsSame?: () => void;
}) {
  const multiline = fieldKey ? WS_MULTILINE_KEYS.has(fieldKey) : false;
  const toRaw = (v: string) => currency ? v.replace(/^\$/, '').trim() : v;
  const [localVal, setLocalVal] = useState(toRaw(value));

  useEffect(() => {
    setLocalVal(toRaw(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let next: string;
    if (currency) {
      next = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    } else {
      next = e.target.value;
    }
    setLocalVal(next);
    // Bubble raw value up — formatting happens on blur
    onChange(next);
  };

  const handleBlur = () => {
    if (currency) {
      const num = parseFloat(localVal);
      if (!localVal || isNaN(num)) {
        setLocalVal('');
        onChange('');
      } else {
        const formatted = `$${num.toFixed(2)}`;
        setLocalVal(num.toFixed(2));
        onChange(formatted);
      }
    }
  };

  const borderClasses = disabled
    ? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-900/30 dark:border-gray-800 dark:text-gray-600'
    : needsReview
      ? 'bg-amber-50 border-amber-300 text-amber-800 focus-within:border-amber-500 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-300'
      : highlight
        ? 'bg-rose-50 border-rose-300 text-rose-800 focus-within:border-rose-500 dark:bg-rose-950/20 dark:border-rose-800/40 dark:text-rose-300'
        : 'bg-gray-50 border-gray-200 text-gray-800 focus-within:border-brand-blue dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-300 dark:focus-within:border-brand-blue';

  return (
    <div className={`flex ${multiline ? 'items-start' : 'items-center'} gap-3`}>
      <label className={`text-[10px] font-bold font-sans min-w-[90px] whitespace-nowrap ${multiline ? 'pt-1.5' : ''} ${needsReview ? 'text-amber-500' : highlight ? 'text-rose-500' : 'text-gray-400 dark:text-gray-600'}`}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={localVal}
          onChange={handleInput}
          disabled={disabled}
          placeholder={placeholder}
          rows={Math.max(2, Math.min(6, localVal.split('\n').length))}
          className={`flex-1 rounded border outline-none text-xs font-mono transition-colors px-2 py-1 resize-none ${borderClasses} ${disabled ? 'cursor-not-allowed' : ''}`}
        />
      ) : (
        <div className={`flex-1 flex items-center rounded border outline-none text-xs font-mono transition-colors px-2 py-1 ${borderClasses}`}>
          {currency && <span className="text-xs font-mono text-gray-400 dark:text-gray-500 pr-0.5">$</span>}
          <input
            value={localVal}
            onChange={handleInput}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={currency ? '0.00' : placeholder}
            inputMode={currency ? 'decimal' : undefined}
            className={`flex-1 bg-transparent outline-none text-xs font-mono text-inherit ${disabled ? 'cursor-not-allowed' : ''}`}
          />
        </div>
      )}
      {needsReview && onMarkAsSame && (
        <button
          onClick={onMarkAsSame}
          className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          title="Mark as same"
        >
          <Check className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Filter Sidebar ──────────────────────────────────────────────────────────

function FilterSidebar({
  byPlatform,
  byType,
  platformFilter,
  typeFilter,
  onPlatformFilter,
  onTypeFilter,
  totalCount,
  activeTab,
}: {
  byPlatform: Record<string, number>;
  byType: Record<string, number>;
  platformFilter: string | null;
  typeFilter: string | null;
  onPlatformFilter: (p: string | null) => void;
  onTypeFilter: (t: string | null) => void;
  totalCount: number;
  activeTab: 'flagged' | 'missing-amount';
}) {
  const [showFilters, setShowFilters] = useState(true);
  const hasFilters = platformFilter !== null || typeFilter !== null;
  const accentText = activeTab === 'flagged' ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="border-b border-gray-100 dark:border-gray-800/50 shrink-0">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <span>Filters</span>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={(e) => { e.stopPropagation(); onPlatformFilter(null); onTypeFilter(null); }}
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border text-gray-400 border-gray-300 hover:text-gray-600 dark:text-gray-600 dark:border-gray-700 dark:hover:text-gray-400"
            >
              Clear
            </button>
          )}
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </button>

      {showFilters && (
        <div className="px-3 pb-3 space-y-3">
          {/* By Platform */}
          {Object.keys(byPlatform).length > 0 && (
            <div>
              <div className="text-[9px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-1.5">
                Platform
              </div>
              <div className="space-y-0.5">
                {Object.entries(byPlatform)
                  .sort(([, a], [, b]) => b - a)
                  .map(([platform, count]) => {
                    const isSelected = platformFilter === platform;
                    const isDimmed = platformFilter !== null && !isSelected;
                    return (
                      <button
                        key={platform}
                        onClick={() => onPlatformFilter(isSelected ? null : platform)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all ${
                          isSelected ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                        }`}
                        style={{ opacity: isDimmed ? 0.4 : 1 }}
                      >
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: PLATFORM_COLORS[platform] || '#888' }}
                        />
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 flex-1">
                          {PLATFORM_LABELS[platform] || platform}
                        </span>
                        <span className={`text-[9px] font-bold font-mono ${accentText}`}>{count}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* By Type */}
          {Object.keys(byType).length > 0 && (
            <div>
              <div className="text-[9px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-1.5">
                Task Type
              </div>
              <div className="space-y-0.5">
                {Object.entries(byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const color = TASK_TYPE_COLORS[type] || '#888';
                    const isSelected = typeFilter === type;
                    const isDimmed = typeFilter !== null && !isSelected;
                    return (
                      <button
                        key={type}
                        onClick={() => onTypeFilter(isSelected ? null : type)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all ${
                          isSelected ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                        }`}
                        style={{ opacity: isDimmed ? 0.4 : 1 }}
                      >
                        <div className="h-2 w-2 rounded shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 flex-1">{type}</span>
                        <span className={`text-[9px] font-bold font-mono ${accentText}`}>{count}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Model Context Panel ─────────────────────────────────────────────────────

function parseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return val.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function ModelContextPanel({ profileId }: { profileId: string | null }) {
  const { data: profile, isLoading } = useInstagramProfile(profileId);

  if (!profileId) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-gray-600">
        Select a task to see model context
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-gray-600">
        Profile not found
      </div>
    );
  }

  const bible = profile.modelBible ?? {};
  const personality = bible.personalityDescription ?? '';
  const background = bible.backstory ?? '';
  const lingo = parseArray(bible.lingoKeywords);
  const emojis = parseArray(bible.preferredEmojis);
  const restrictions = [
    bible.restrictions?.contentLimitations,
    bible.restrictions?.wallRestrictions,
    bible.restrictions?.mmExclusions,
    bible.restrictions?.customsToAvoid,
  ].filter(Boolean) as string[];
  const wordingToAvoid = parseArray(bible.restrictions?.wordingToAvoid);
  const operatorNotes = bible.captionOperatorNotes ?? '';
  const pageStrategy = profile.pageStrategy ?? '';

  return (
    <div className="flex flex-col h-full overflow-auto custom-scrollbar">
      {/* Model header */}
      <div className="px-4 py-4 border-b border-gray-200/50 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          {profile.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profileImageUrl}
              alt={profile.name}
              className="w-11 h-11 rounded-xl object-cover shadow-lg shadow-amber-500/20"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center text-base font-bold text-amber-500 shadow-lg shadow-amber-500/20">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{profile.name}</p>
            {pageStrategy && (
              <span className="mt-0.5 inline-block px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[10px] font-semibold">
                {pageStrategy}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-5">
        {/* Restrictions */}
        {(restrictions.length > 0 || wordingToAvoid.length > 0) && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-500/30 rounded-xl ring-1 ring-red-200 dark:ring-red-800/30 shadow-sm shadow-red-500/5">
            <div className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} className="shrink-0" />
              Restrictions &amp; Things to Avoid
            </div>
            {restrictions.map((r, i) => (
              <div key={i} className="text-xs text-red-700 dark:text-red-300 py-1 flex items-start gap-2">
                <X size={11} className="shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
            {wordingToAvoid.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-red-200 dark:border-red-700/50">
                <div className="text-[10px] font-bold text-red-600 dark:text-red-400 mb-1.5 uppercase tracking-wide">
                  Words / Phrases to Avoid:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wordingToAvoid.map((word, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/40 rounded-md text-[10px] font-medium"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personality */}
        {personality && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Personality</div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-xl text-xs leading-relaxed text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-white/[0.06] whitespace-pre-wrap">
              {personality}
            </div>
          </div>
        )}

        {/* Background */}
        {background && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Background</div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-xl text-xs leading-relaxed text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/[0.06] whitespace-pre-wrap">
              {background}
            </div>
          </div>
        )}

        {/* Lingo */}
        {lingo.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Lingo &amp; Keywords</div>
            <div className="flex flex-wrap gap-1.5">
              {lingo.map((word) => (
                <span
                  key={word}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/[0.08] rounded-lg text-[11px] text-gray-700 dark:text-gray-300"
                >
                  &ldquo;{word}&rdquo;
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Emojis */}
        {emojis.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Preferred Emojis</div>
            <div className="flex flex-wrap gap-1.5">
              {emojis.map((emoji) => (
                <span
                  key={emoji}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/[0.08] rounded-lg text-sm"
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Operator Notes */}
        {operatorNotes && (
          <div>
            <div className="text-[10px] font-semibold text-brand-blue uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Info size={11} />
              Operator Notes
            </div>
            <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/15 rounded-xl text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {operatorNotes}
            </div>
          </div>
        )}

        {!personality && !background && restrictions.length === 0 && !operatorNotes && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900/50 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                This model&apos;s context is not fully configured yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface SchedulerWorkspaceProps {
  profileId: string | null;
  schedulerToday: string;
  weekStart: string;
  profileName?: string;
  defaultTab?: 'flagged' | 'missing-amount';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchedulerWorkspace({
  profileId,
  schedulerToday,
  weekStart,
  profileName,
  defaultTab = 'flagged',
}: SchedulerWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'flagged' | 'missing-amount'>(defaultTab);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modalTask, setModalTask] = useState<SchedulerTask | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Platform + type filters
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const updateTask = useUpdatePodTask();
  const mergeFields = useMergeTaskFields();
  const { setActiveTask } = useSchedulerPresenceContext();

  const flaggedQuery = useWorkspaceTasks('flagged', profileId, schedulerToday);
  const missingQuery = useWorkspaceTasks('missing-amount', profileId, schedulerToday);

  const activeQuery = activeTab === 'flagged' ? flaggedQuery : missingQuery;

  const allItems = useMemo(() => {
    return activeQuery.data?.pages.flatMap((p) => p.items) ?? [];
  }, [activeQuery.data]);

  const totalCount = activeQuery.data?.pages[0]?.totalCount ?? 0;

  // Accumulate filter breakdowns
  const { byPlatform, byType } = useMemo(() => {
    const bp: Record<string, number> = {};
    const bt: Record<string, number> = {};
    for (const t of allItems) {
      bp[t.platform] = (bp[t.platform] || 0) + 1;
      bt[t.taskType] = (bt[t.taskType] || 0) + 1;
    }
    return { byPlatform: bp, byType: bt };
  }, [allItems]);

  // Apply search + filters (API already returns oldest → newest)
  const filteredItems = useMemo(() => {
    let items = allItems;
    if (platformFilter) items = items.filter((t) => t.platform === platformFilter);
    if (typeFilter) items = items.filter((t) => t.taskType === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((t) => {
        const label = getTaskLabel(t).toLowerCase();
        const fields = (t.fields || {}) as Record<string, string>;
        const caption = (fields.captionBankText || fields.caption || '').toLowerCase();
        return label.includes(q) || caption.includes(q) || t.platform.includes(q) || t.taskType.toLowerCase().includes(q);
      });
    }
    return items;
  }, [allItems, platformFilter, typeFilter, searchQuery]);

  const selectedTask = filteredItems[selectedIndex] ?? null;

  // Broadcast presence for the selected task
  useEffect(() => {
    setActiveTask(selectedTask?.id ?? null);
    return () => setActiveTask(null);
  }, [selectedTask?.id, setActiveTask]);

  // Clamp selected index
  useEffect(() => {
    if (filteredItems.length > 0 && selectedIndex >= filteredItems.length) {
      setSelectedIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, selectedIndex]);

  const handleTaskUpdate = useCallback(
    (id: string, data: Partial<SchedulerTask>) => {
      updateTask.mutate({ id, ...data, tabId });
    },
    [updateTask],
  );

  const handleSaveField = useCallback(
    (taskId: string, fieldPatch: Record<string, string>) => {
      mergeFields.mutate({ id: taskId, fields: fieldPatch, tabId });
    },
    [mergeFields],
  );

  const handleUnflag = useCallback(
    (taskId: string) => {
      mergeFields.mutate({ id: taskId, fields: { flagged: 'false' }, tabId });
    },
    [mergeFields],
  );

  // Reset state when switching tabs
  const switchTab = useCallback((tab: 'flagged' | 'missing-amount') => {
    setActiveTab(tab);
    setSelectedIndex(0);
    setPlatformFilter(null);
    setTypeFilter(null);
    setSearchQuery('');
  }, []);

  // Sync defaultTab changes (from parent navigation)
  const prevDefaultTab = useRef(defaultTab);
  useEffect(() => {
    if (defaultTab !== prevDefaultTab.current) {
      prevDefaultTab.current = defaultTab;
      switchTab(defaultTab);
    }
  }, [defaultTab, switchTab]);

  const flaggedTotal = flaggedQuery.data?.pages[0]?.totalCount;
  const missingTotal = missingQuery.data?.pages[0]?.totalCount;

  const profileLabel = profileName || 'All Profiles';

  const accentBorder = activeTab === 'flagged' ? 'border-amber-500/20' : 'border-rose-500/20';
  const accentGradientFrom = activeTab === 'flagged' ? 'from-amber-500' : 'from-rose-500';
  const accentGradientTo = activeTab === 'flagged' ? 'to-amber-600' : 'to-rose-600';
  const accentShadow = activeTab === 'flagged' ? 'shadow-amber-500/30' : 'shadow-rose-500/30';
  const accentBg = activeTab === 'flagged' ? 'bg-amber-500/15' : 'bg-rose-500/15';
  const accentTextColor = activeTab === 'flagged' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className={`h-[calc(100vh-7rem)] overflow-hidden bg-brand-off-white dark:bg-gray-950 border ${accentBorder} rounded-2xl shadow-lg m-2`}>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] grid-rows-[56px_1fr] h-full">
        {/* ─── Header ─── */}
        <div className={`col-span-1 lg:col-span-3 px-4 lg:px-6 border-b ${accentBorder} flex items-center justify-between bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl sticky top-0 z-40 rounded-t-2xl`}>
          <div className="flex items-center gap-3 lg:gap-4">
            <div className={`flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-linear-to-br ${accentGradientFrom} ${accentGradientTo} shadow-lg ${accentShadow}`}>
              {activeTab === 'flagged' ? (
                <Flag className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              ) : (
                <DollarSign className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Scheduler Workspace
              </h1>
              <p className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400">
                {profileLabel}
              </p>
            </div>
            <span className={`hidden sm:inline-block px-2 py-1 ${accentBg} ${accentTextColor} rounded text-[10px] lg:text-xs font-semibold`}>
              {totalCount} {activeTab === 'flagged' ? 'flagged' : 'missing final amount'}
            </span>
          </div>

          {/* Sub-tab toggles */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => switchTab('flagged')}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg font-sans transition-all ${
                activeTab === 'flagged'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Flag className="h-3 w-3" />
              Flagged
              {flaggedTotal !== undefined && (
                <span className="text-[8px] font-mono bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full">
                  {flaggedTotal}
                </span>
              )}
            </button>
            <button
              onClick={() => switchTab('missing-amount')}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg font-sans transition-all ${
                activeTab === 'missing-amount'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <DollarSign className="h-3 w-3" />
              Missing Final Amount
              {missingTotal !== undefined && (
                <span className="text-[8px] font-mono bg-rose-500/15 text-rose-500 px-1.5 py-0.5 rounded-full">
                  {missingTotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ─── Loading State ─── */}
        {activeQuery.isLoading && (
          <div className="col-span-1 lg:col-span-3 flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className={`w-8 h-8 border-2 ${activeTab === 'flagged' ? 'border-amber-500/30 border-t-amber-500' : 'border-rose-500/30 border-t-rose-500'} rounded-full animate-spin`} />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading tasks...</p>
            </div>
          </div>
        )}

        {/* ─── Empty State ─── */}
        {!activeQuery.isLoading && allItems.length === 0 && (
          <div className="col-span-1 lg:col-span-3 flex items-center justify-center py-20">
            <div className="text-center max-w-md px-4">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${accentBg} flex items-center justify-center`}>
                {activeTab === 'flagged' ? (
                  <Flag className="w-8 h-8 text-amber-500" />
                ) : (
                  <DollarSign className="w-8 h-8 text-rose-500" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">All clear!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeTab === 'flagged'
                  ? 'No flagged tasks this month. Tasks will appear here when flagged on the scheduler.'
                  : 'No tasks with missing final amount. Past-date unlock tasks without a final amount will appear here.'}
              </p>
            </div>
          </div>
        )}

        {/* ─── Main Content ─── */}
        {!activeQuery.isLoading && allItems.length > 0 && (
          <>
            {/* Left Panel: Queue */}
            <div className="hidden lg:flex lg:flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-gray-900/80">
              {/* Search */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800/50 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-brand-blue dark:focus:border-brand-blue"
                  />
                </div>
              </div>

              {/* Filters */}
              <FilterSidebar
                byPlatform={byPlatform}
                byType={byType}
                platformFilter={platformFilter}
                typeFilter={typeFilter}
                onPlatformFilter={setPlatformFilter}
                onTypeFilter={setTypeFilter}
                totalCount={totalCount}
                activeTab={activeTab}
              />

              {/* Task queue list */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="divide-y divide-gray-50 dark:divide-gray-800/30">
                  {filteredItems.map((task, idx) => (
                    <QueueItem
                      key={task.id}
                      task={task}
                      isSelected={idx === selectedIndex}
                      onSelect={() => setSelectedIndex(idx)}
                      activeTab={activeTab}
                      schedulerToday={schedulerToday}
                    />
                  ))}
                </div>

                {/* Load more */}
                {activeQuery.hasNextPage && (
                  <div className="flex justify-center p-3">
                    <button
                      onClick={() => activeQuery.fetchNextPage()}
                      disabled={activeQuery.isFetchingNextPage}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-4 py-1.5 rounded-lg font-sans border transition-all disabled:opacity-50 ${
                        activeTab === 'flagged'
                          ? 'text-amber-500 border-amber-500/30 hover:bg-amber-500/10'
                          : 'text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
                      }`}
                    >
                      {activeQuery.isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load more'
                      )}
                    </button>
                  </div>
                )}

                {filteredItems.length === 0 && (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-xs text-gray-400 dark:text-gray-500">No matches</p>
                  </div>
                )}
              </div>
            </div>

            {/* Center Panel: Task Detail */}
            <div className="flex flex-col h-full min-h-0 overflow-hidden border-x border-gray-100 dark:border-gray-800/50">
              {selectedTask ? (
                <TaskDetailPanel
                  task={selectedTask}
                  activeTab={activeTab}
                  onOpenModal={() => setModalTask(selectedTask)}
                  onSaveField={handleSaveField}
                  onUnflag={handleUnflag}
                  onTaskUpdate={handleTaskUpdate}
                  isSaving={mergeFields.isPending}
                  schedulerToday={schedulerToday}
                  weekStart={weekStart}
                  profileName={profileName}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full ${accentBg} flex items-center justify-center`}>
                      {activeTab === 'flagged' ? (
                        <Flag className="w-6 h-6 text-amber-500" />
                      ) : (
                        <DollarSign className="w-6 h-6 text-rose-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Select a task to view details</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Model Context */}
            <div className="hidden lg:flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-gray-900/80 border-l border-gray-100 dark:border-gray-800/50">
              <ModelContextPanel profileId={selectedTask?.profileId ?? null} />
            </div>
          </>
        )}
      </div>

      {/* Task modal */}
      {modalTask && (
        <SchedulerTaskModal
          task={modalTask}
          open={!!modalTask}
          onClose={() => setModalTask(null)}
          onUpdate={handleTaskUpdate}
          schedulerToday={schedulerToday}
          weekStart={modalTask.weekStartDate?.toString().split('T')[0] || weekStart}
          profileName={profileName}
        />
      )}
    </div>
  );
}
