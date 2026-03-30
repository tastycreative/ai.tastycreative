'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Flag, AlertCircle, Loader2, Search, Clock, DollarSign, Eye, ChevronDown, ChevronUp, Check, X, TrendingUp, ImageOff, Lock, Send } from 'lucide-react';
import {
  useWorkspaceTasks,
  SchedulerTask,
  useUpdatePodTask,
  useMergeTaskFields,
  useLineageEarnings,
  useQueueTaskUpdate,
  isTaskLocked,
  TASK_FIELD_DEFS,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS, TaskViewerAvatars, TaskViewerBanner } from './task-cards/shared';
import { useSchedulerPresenceContext } from './SchedulerPresenceContext';
import { SchedulerTaskModal } from './SchedulerTaskModal';
import { QueueCalendar } from './QueueCalendar';
import { CaptionPicker, type CaptionSelection } from './pickers/CaptionPicker';
import { tabId } from '@/lib/hooks/useSchedulerRealtime';

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
  isSaving,
  schedulerToday,
}: {
  task: SchedulerTask;
  activeTab: 'flagged' | 'missing-amount';
  onOpenModal: () => void;
  onSaveField: (taskId: string, fieldPatch: Record<string, string>) => void;
  onUnflag: (taskId: string) => void;
  isSaving: boolean;
  schedulerToday: string;
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
  }, [task.id, serverFields.finalAmount]);

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
  const editableFields = useMemo(() => {
    return fieldDefs
      .filter((def) => def.key !== 'caption')
      .filter((def) => def.key !== 'type')
      .filter((def) => def.key !== 'subType')
      .filter((def) => def.key !== 'finalAmount' || task.taskType === 'WP' || (fields.type || '').toLowerCase().includes('unlock'));
  }, [fieldDefs, task.taskType, fields.type]);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setLocalFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    // Collect all changed fields
    const patch: Record<string, string> = {};
    for (const k of Object.keys(localFields)) {
      if (localFields[k] !== (serverFields[k] || '')) {
        patch[k] = localFields[k];
      }
    }
    if (Object.keys(patch).length === 0) return;
    onSaveField(task.id, patch);
    setLocalFields({});
  }, [localFields, serverFields, task.id, onSaveField]);

  // Caption picker handlers
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
    onSaveField(task.id, patch);
  }, [task.id, onSaveField]);

  const handleClearCaption = useCallback(() => {
    const patch = { captionId: '', captionBankText: '' };
    setLocalFields((prev) => ({ ...prev, ...patch }));
    onSaveField(task.id, patch);
  }, [task.id, onSaveField]);

  const handleCaptionOverride = useCallback((text: string) => {
    const patch = { caption: text, captionId: '', captionBankText: '' };
    setLocalFields((prev) => ({ ...prev, ...patch }));
    // Don't save on every keystroke — will be saved on blur via field row
  }, []);

  const accentBorder = activeTab === 'flagged' ? 'border-amber-500/30' : 'border-rose-500/30';
  const hasPreviewUrl = URL_REGEX.test(previewUrl);

  return (
    <div className="flex-1 overflow-y-auto p-5">
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
          <span>This task&apos;s date has passed. Use <strong>Queue</strong> below to move it to a future date.</span>
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

      {/* Editable field rows */}
      <div className="mb-4 space-y-1.5">
        <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
          Details
        </div>
        {editableFields.map((def) => {
          const isCurrency = def.key === 'price' || def.key === 'finalAmount';
          // Missing-amount tab: only finalAmount editable; Flagged+locked: only finalAmount editable
          const isDisabled = def.key !== 'finalAmount' && (isMissingAmountTab || locked);
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

      {/* Caption Picker — hidden on missing-amount tab and locked flagged tasks */}
      {TYPES_WITH_PICKER.has(task.taskType) && !locked && !isMissingAmountTab && (
        <div className="mb-4">
          <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Caption{fields.captionId && isFlagged ? ' 🚩' : ''}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-900/50">
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

      {/* ── Queue section for locked tasks ── */}
      {locked && (
        <div className="mb-4">
          <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
            Queue to Future Date
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
          <button
            onClick={handleQueue}
            disabled={!queueTargetWeek || queueMutation.isPending}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold font-sans border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: queueTargetWeek ? typeColor + '10' : undefined,
              color: queueTargetWeek ? typeColor : undefined,
              borderColor: queueTargetWeek ? typeColor + '40' : undefined,
            }}
          >
            {queueMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {queueTargetWeek ? (
              <>
                Queue for{' '}
                {(() => {
                  const ws = new Date(queueTargetWeek + 'T00:00:00Z');
                  ws.setUTCDate(ws.getUTCDate() + task.dayOfWeek);
                  return !isNaN(ws.getTime())
                    ? ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                    : queueTargetWeek;
                })()}
              </>
            ) : (
              'Select a date to queue'
            )}
          </button>
        </div>
      )}

      {/* ── Save button ── */}
      <button
        onClick={handleSave}
        disabled={!hasPendingChanges || isSaving}
        className={[
          'w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold font-sans border transition-colors',
          hasPendingChanges
            ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40 dark:hover:bg-green-900/30'
            : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed dark:bg-gray-900/20 dark:text-gray-600 dark:border-gray-800/40',
        ].join(' ')}
      >
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        {isSaving ? 'Saving...' : hasPendingChanges ? 'Save Changes' : 'Saved'}
      </button>
    </div>
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
}: {
  label: string;
  value: string;
  placeholder?: string;
  currency?: boolean;
  highlight?: boolean;
  fieldKey?: string;
  disabled?: boolean;
  onChange: (val: string) => void;
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
    : highlight
      ? 'bg-rose-50 border-rose-300 text-rose-800 focus-within:border-rose-500 dark:bg-rose-950/20 dark:border-rose-800/40 dark:text-rose-300'
      : 'bg-gray-50 border-gray-200 text-gray-800 focus-within:border-brand-blue dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-300 dark:focus-within:border-brand-blue';

  return (
    <div className={`flex ${multiline ? 'items-start' : 'items-center'} gap-3`}>
      <label className={`text-[10px] font-bold font-sans min-w-[90px] whitespace-nowrap ${multiline ? 'pt-1.5' : ''} ${highlight ? 'text-rose-500' : 'text-gray-400 dark:text-gray-600'}`}>
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
    <div className="border-b border-gray-100 dark:border-gray-800/50">
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

  const flaggedQuery = useWorkspaceTasks('flagged', profileId, schedulerToday, activeTab === 'flagged');
  const missingQuery = useWorkspaceTasks('missing-amount', profileId, schedulerToday, activeTab === 'missing-amount');

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
    <div className={`flex-1 overflow-hidden bg-brand-off-white dark:bg-gray-950 border ${accentBorder} rounded-2xl shadow-lg m-2`}>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] grid-rows-[56px_1fr] h-full">
        {/* ─── Header ─── */}
        <div className={`col-span-1 lg:col-span-3 px-4 lg:px-6 border-b ${accentBorder} flex items-center justify-between bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl sticky top-0 z-40 rounded-t-2xl`}>
          <div className="flex items-center gap-3 lg:gap-4">
            <div className={`flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-linear-to-br ${accentGradientFrom} ${accentGradientTo} shadow-lg ${accentShadow}`}>
              {activeTab === 'flagged' ? (
                <Flag className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              ) : (
                <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
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
              <AlertCircle className="h-3 w-3" />
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
                  <AlertCircle className="w-8 h-8 text-rose-500" />
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
            <div className="hidden lg:flex lg:flex-col h-full overflow-hidden bg-white dark:bg-gray-900/80">
              {/* Search */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800/50">
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
              <div className="flex-1 overflow-y-auto">
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
                  isSaving={mergeFields.isPending}
                  schedulerToday={schedulerToday}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full ${accentBg} flex items-center justify-center`}>
                      {activeTab === 'flagged' ? (
                        <Flag className="w-6 h-6 text-amber-500" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-rose-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Select a task to view details</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Summary / Stats */}
            <div className="hidden lg:flex flex-col h-full overflow-y-auto bg-white dark:bg-gray-900/80">
              <div className={`px-4 py-3 border-b ${accentBorder}`}>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Summary</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Total count */}
                <div className="text-center">
                  <div className={`text-3xl font-bold font-mono ${activeTab === 'flagged' ? 'text-amber-500' : 'text-rose-500'}`}>
                    {totalCount}
                  </div>
                  <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-1">
                    {activeTab === 'flagged' ? 'Flagged Tasks' : 'Missing Final Amounts'}
                  </div>
                </div>

                {/* Platform breakdown */}
                {Object.keys(byPlatform).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                      By Platform
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(byPlatform)
                        .sort(([, a], [, b]) => b - a)
                        .map(([platform, count]) => {
                          const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                          return (
                            <div key={platform}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: PLATFORM_COLORS[platform] || '#888' }}
                                  />
                                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                                    {PLATFORM_LABELS[platform] || platform}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-bold font-mono ${activeTab === 'flagged' ? 'text-amber-500' : 'text-rose-500'}`}>
                                  {count}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: PLATFORM_COLORS[platform] || '#888',
                                    opacity: 0.7,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Type breakdown */}
                {Object.keys(byType).length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold font-sans uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                      By Type
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(byType)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => {
                          const color = TASK_TYPE_COLORS[type] || '#888';
                          const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                          return (
                            <div key={type}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-2 w-2 rounded" style={{ backgroundColor: color }} />
                                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">{type}</span>
                                </div>
                                <span className={`text-[10px] font-bold font-mono ${activeTab === 'flagged' ? 'text-amber-500' : 'text-rose-500'}`}>
                                  {count}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Showing info */}
                <div className="text-center pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Showing {filteredItems.length} of {allItems.length} loaded
                    {totalCount > allItems.length && ` (${totalCount} total)`}
                  </p>
                </div>
              </div>
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
