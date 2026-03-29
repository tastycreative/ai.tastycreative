'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSchedulerPresenceContext, type PresenceMember } from '../SchedulerPresenceContext';
import {
  Clock,
  Play,
  CheckCircle2,
  SkipForward,
  ChevronDown,
  Trash2,
  Flag,
  Image as ImageIcon,
  Copy,
  Check,
} from 'lucide-react';
import { SchedulerTask, TaskFields, useMergeTaskFields } from '@/lib/hooks/useScheduler.query';
import { tabId } from '@/lib/hooks/useSchedulerRealtime';
import { formatTimeInTz, formatDuration } from '@/lib/scheduler/time-helpers';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

export const LA_TZ = 'America/Los_Angeles';

export const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'PENDING', label: 'Pending', color: '#3a3a5a' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#38bdf8' },
  { key: 'DONE', label: 'Done', color: '#4ade80' },
  { key: 'SKIPPED', label: 'Skipped', color: '#fbbf24' },
];

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-2.5 w-2.5" />,
  IN_PROGRESS: <Play className="h-2.5 w-2.5" />,
  DONE: <CheckCircle2 className="h-2.5 w-2.5" />,
  SKIPPED: <SkipForward className="h-2.5 w-2.5" />,
};

/** "Done" indicator: green check + "Posted" badge, shown on DONE tasks */
export function PostedBadge() {
  return (
    <>
      <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500/70" />
      <span className="text-[7px] font-bold px-1 py-px rounded bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
        Posted
      </span>
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskCardProps {
  task: SchedulerTask;
  team: string;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  schedulerToday?: string;
  weekStart?: string;
  profileName?: string;
  autoOpen?: boolean;
  onModalOpen?: (slotLabel: string) => void;
  onModalClose?: () => void;
}

// ─── Inline Editable Field Row (expanded mode) ───────────────────────────────

export function FieldRow({
  label,
  value,
  placeholder,
  onSave,
  labelWidth = 'min-w-[60px]',
  noTruncate,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
  labelWidth?: string;
  noTruncate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleBlur = useCallback(() => {
    const trimmed = localVal.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
  }, [localVal, value, onSave]);

  return (
    <div className="flex items-start gap-1.5 px-1 min-h-[18px]">
      <span className={`text-[9px] font-bold text-gray-400 dark:text-gray-600 whitespace-nowrap mt-[1px] font-sans ${labelWidth}`}>
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.blur()}
          className="flex-1 text-[10px] border-b px-0.5 py-0 outline-none font-mono bg-gray-50 text-gray-900 border-brand-blue dark:bg-gray-950 dark:text-gray-200 dark:border-[#38bdf8] min-w-0"
          placeholder={placeholder}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-[10px] cursor-text font-mono min-w-0 text-gray-700 dark:text-gray-300 ${noTruncate ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
        >
          {value || (
            <span className="text-gray-400 dark:text-gray-700 italic">
              {placeholder || 'click to add...'}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// ─── Status Dropdown ──────────────────────────────────────────────────────────

export function StatusBadge({
  task,
  onUpdate,
  size = 'sm',
}: {
  task: SchedulerTask;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  size?: 'sm' | 'md';
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = useCallback((newStatus: string) => {
    const updates: Partial<SchedulerTask> = { status: newStatus as SchedulerTask['status'] };
    if (newStatus === 'IN_PROGRESS' && !task.startTime) updates.startTime = new Date().toISOString();
    if (newStatus === 'DONE' && task.startTime && !task.endTime) updates.endTime = new Date().toISOString();
    onUpdate(task.id, updates);
    setShow(false);
  }, [task, onUpdate]);

  const statusOpt = STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];
  const textSize = size === 'md' ? 'text-[10px]' : 'text-[9px]';
  const px = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(!show)}
        className={`flex items-center gap-1 ${textSize} font-bold tracking-wide ${px} rounded-full border transition-all font-sans`}
        style={{
          color: statusOpt.color,
          borderColor: statusOpt.color + '40',
          background: statusOpt.color + '15',
        }}
      >
        {STATUS_ICONS[task.status]}
        {statusOpt.label.toUpperCase()}
        <ChevronDown className="h-2 w-2" />
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[110px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleChange(opt.key)}
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
  );
}

// ─── Type Badge Dropdown ──────────────────────────────────────────────────────

export const TASK_TYPES = ['MM', 'WP', 'ST', 'SP'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_COLORS: Record<string, string> = {
  MM: '#f472b6',
  WP: '#38bdf8',
  ST: '#c084fc',
  SP: '#fb923c',
};

export function TypeBadge({
  task,
  size = 'sm',
}: {
  task: SchedulerTask;
  onUpdate?: (id: string, data: Partial<SchedulerTask>) => void;
  size?: 'sm' | 'md';
}) {
  const typeColor = TASK_TYPE_COLORS[task.taskType] || '#3a3a5a';
  const textSize = size === 'md' ? 'text-[10px]' : 'text-[9px]';
  const px = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <span
      className={`flex items-center ${textSize} font-bold ${px} rounded-full font-sans border`}
      style={{
        background: typeColor + '20',
        color: typeColor,
        border: `1px solid ${typeColor}40`,
      }}
    >
      #{task.slotLabel}-{task.taskType || 'TYPE'}
    </span>
  );
}

// ─── Delete Button ────────────────────────────────────────────────────────────

export function DeleteButton({ onDelete, size = 'sm' }: { onDelete: () => void; size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3';
  return (
    <button
      onClick={onDelete}
      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      title="Delete task"
    >
      <Trash2 className={`${iconSize} text-red-400 dark:text-red-500`} />
    </button>
  );
}

// ─── Time Display ─────────────────────────────────────────────────────────────

export function TimeDisplay({ task }: { task: SchedulerTask }) {
  if (!task.startTime) return null;
  return (
    <div className="flex items-center gap-1 text-[9px] px-1 font-mono text-gray-500 dark:text-gray-600">
      <Clock className="h-2.5 w-2.5" />
      {formatTimeInTz(task.startTime, LA_TZ)}
      {task.endTime && (
        <>
          <span>→</span>
          <span>{formatTimeInTz(task.endTime, LA_TZ)}</span>
          <span className="text-green-600 dark:text-[#4ade80]">
            ({formatDuration(task.startTime, task.endTime)})
          </span>
        </>
      )}
      {!task.endTime && task.status === 'IN_PROGRESS' && (
        <span className="animate-pulse text-brand-blue dark:text-[#38bdf8]">
          {formatDuration(task.startTime, new Date().toISOString())}
        </span>
      )}
    </div>
  );
}

// ─── Field save helper ────────────────────────────────────────────────────────

export function useFieldSave(
  task: SchedulerTask,
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void,
) {
  const fields = (task.fields || {}) as Record<string, string>;
  const save = useCallback((key: string, val: string) => {
    const merged = { ...fields, [key]: val } as TaskFields;
    onUpdate(task.id, { fields: merged });
  }, [fields, task.id, onUpdate]);
  return { fields, save };
}

// ─── Flag toggle (uses merge mutation — safe for rapid clicks) ───────────────

export function useFlagToggle(taskId: string, currentFlagged: boolean) {
  const merge = useMergeTaskFields();
  const toggle = useCallback(() => {
    merge.mutate({
      id: taskId,
      fields: { flagged: currentFlagged ? '' : 'true' },
      tabId,
    });
  }, [taskId, currentFlagged, merge]);
  return toggle;
}

// ─── Copy Caption Button ─────────────────────────────────────────────────────

export function CopyCaptionButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Caption copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      onPointerDown={(e) => e.stopPropagation()}
      className={`shrink-0 p-0.5 rounded-sm transition-all ${
        copied
          ? 'text-green-500'
          : 'text-gray-400 dark:text-gray-600 hover:text-brand-blue dark:hover:text-brand-blue'
      }`}
      title={copied ? 'Copied!' : 'Copy caption'}
    >
      {copied ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <Copy className="h-2.5 w-2.5" />
      )}
    </button>
  );
}

// ─── Caption Preview (compact inline) ────────────────────────────────────────

export function CaptionPreview({
  fields,
  typeColor,
  noTruncate,
}: {
  fields: Record<string, string>;
  typeColor: string;
  noTruncate?: boolean;
}) {
  const text = fields.captionBankText || fields.caption;
  const isBankCaption = !!fields.captionId;
  const isFlagged = fields.flagged === 'true' || fields.flagged === true as unknown as string;

  if (!text) return null;

  return (
    <div className="flex items-start gap-1 px-1 min-h-[18px]">
      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 whitespace-nowrap mt-[1px] font-sans min-w-[60px]">
        Caption
      </span>
      <div className="flex-1 min-w-0 flex items-start gap-1">
        {isFlagged && (
          <span className="text-[8px] shrink-0 mt-[1px]" title="Needs replacement">🚩</span>
        )}
        <span className={`text-[10px] font-mono text-gray-700 dark:text-gray-300 ${noTruncate ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
          {text}
        </span>
        {isBankCaption && (
          <span
            className="text-[7px] shrink-0 px-1 py-0.5 rounded font-sans font-bold mt-[1px]"
            style={{ background: typeColor + '15', color: typeColor }}
          >
            BANK
          </span>
        )}
        <CopyCaptionButton text={text} />
      </div>
    </div>
  );
}

// ─── Flyer Preview (compact inline) ──────────────────────────────────────────

export function FlyerPreview({
  fields,
  noTruncate,
}: {
  fields: Record<string, string>;
  noTruncate?: boolean;
}) {
  const url = fields.flyerAssetUrl;
  if (!url) return null;

  const isImage = /\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(url) || url.includes('/uploads/');

  return (
    <div className="flex items-start gap-1.5 px-1 min-h-[18px]">
      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 whitespace-nowrap mt-[1px] font-sans min-w-[60px]">
        GIF
      </span>
      {isImage ? (
        <div className="w-10 h-10 rounded overflow-hidden border border-gray-700/30 bg-black/20 shrink-0">
          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <ImageIcon className="h-2.5 w-2.5 shrink-0 text-brand-blue" />
          <span className={`text-[9px] font-mono text-brand-blue ${noTruncate ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>
            {url.replace('https://', '').split('/').pop() || url.replace('https://', '')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Flag Toggle Button ──────────────────────────────────────────────────────

export function FlagButton({
  flagged,
  onToggle,
}: {
  flagged: boolean;
  onToggle: () => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle();
  }, [onToggle, flagged]);

  return (
    <button
      data-flag-btn=""
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`shrink-0 rounded-sm transition-all ${
        flagged
          ? 'p-1 bg-amber-500/30 dark:bg-amber-500/25 text-amber-500'
          : 'p-1 text-gray-400 dark:text-gray-600 hover:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-500/15'
      }`}
      title={flagged ? 'Flagged — needs caption update' : 'Flag for caption update'}
    >
      <Flag className="h-3 w-3" fill={flagged ? 'currentColor' : 'none'} style={{ pointerEvents: 'none' }} />
    </button>
  );
}

// ─── Task Viewers (who's currently viewing this task) ─────────────────────

/** Hook to get viewers for a specific task */
export function useTaskViewers(taskId: string): PresenceMember[] {
  const { taskViewers } = useSchedulerPresenceContext();
  return useMemo(() => taskViewers.get(taskId) || [], [taskViewers, taskId]);
}

/** Small stacked avatars showing who is viewing a task */
export function TaskViewerAvatars({
  taskId,
  size = 'sm',
}: {
  taskId: string;
  size?: 'sm' | 'md';
}) {
  const viewers = useTaskViewers(taskId);
  if (viewers.length === 0) return null;

  const dim = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  const textSize = size === 'md' ? 'text-[7px]' : 'text-[6px]';
  const border = size === 'md' ? 'border-[1.5px]' : 'border';

  return (
    <div className="flex -space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      {viewers.slice(0, 3).map((v) =>
        v.imageUrl ? (
          <img
            key={v.clientId}
            src={v.imageUrl}
            alt={v.name}
            title={v.name}
            className={`${dim} rounded-full object-cover ${border} border-white dark:border-[#0c0c1a] ring-1 ring-green-400/50`}
          />
        ) : (
          <div
            key={v.clientId}
            title={v.name}
            className={`${dim} rounded-full flex items-center justify-center ${textSize} font-bold font-sans bg-green-500/15 text-green-500 ${border} border-white dark:border-[#0c0c1a] ring-1 ring-green-400/50`}
          >
            {(v.name || '?')[0].toUpperCase()}
          </div>
        ),
      )}
      {viewers.length > 3 && (
        <div
          className={`${dim} rounded-full flex items-center justify-center ${textSize} font-bold font-mono bg-gray-100 text-gray-500 ${border} border-white dark:bg-[#111124] dark:text-gray-400 dark:border-[#0c0c1a]`}
        >
          +{viewers.length - 3}
        </div>
      )}
    </div>
  );
}

/** Larger viewers display for inside the task modal */
export function TaskViewerBanner({ taskId }: { taskId: string }) {
  const viewers = useTaskViewers(taskId);
  if (viewers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <div className="flex -space-x-1.5">
        {viewers.slice(0, 5).map((v) =>
          v.imageUrl ? (
            <img
              key={v.clientId}
              src={v.imageUrl}
              alt={v.name}
              title={v.name}
              className="h-5 w-5 rounded-full object-cover border-[1.5px] border-white dark:border-[#0c0c1a] ring-1 ring-green-400/50"
            />
          ) : (
            <div
              key={v.clientId}
              title={v.name}
              className="h-5 w-5 rounded-full flex items-center justify-center text-[7px] font-bold font-sans bg-green-500/15 text-green-500 border-[1.5px] border-white dark:border-[#0c0c1a] ring-1 ring-green-400/50"
            >
              {(v.name || '?')[0].toUpperCase()}
            </div>
          ),
        )}
      </div>
      <span className="text-[9px] font-mono text-green-500/70">
        {viewers.map((v) => v.name).join(', ')} viewing
      </span>
    </div>
  );
}
