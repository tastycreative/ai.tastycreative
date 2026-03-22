'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  SkipForward,
  ChevronDown,
  Trash2,
  Flag,
  Image as ImageIcon,
} from 'lucide-react';
import { SchedulerTask, TaskFields } from '@/lib/hooks/useScheduler.query';
import { formatTimeInTz, formatDuration } from '@/lib/scheduler/time-helpers';

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskCardProps {
  task: SchedulerTask;
  team: string;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

// ─── Inline Editable Field Row (expanded mode) ───────────────────────────────

export function FieldRow({
  label,
  value,
  placeholder,
  onSave,
  labelWidth = 'min-w-[60px]',
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (val: string) => void;
  labelWidth?: string;
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
          className="flex-1 text-[10px] cursor-text font-mono truncate min-w-0 text-gray-700 dark:text-gray-300"
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
  onUpdate,
  size = 'sm',
}: {
  task: SchedulerTask;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  size?: 'sm' | 'md';
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const typeColor = TASK_TYPE_COLORS[task.taskType] || '#3a3a5a';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const textSize = size === 'md' ? 'text-[10px]' : 'text-[9px]';
  const px = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShow(!show)}
        className={`flex items-center gap-0.5 ${textSize} font-bold ${px} rounded-full font-sans transition-colors border`}
        style={{
          background: typeColor + '20',
          color: typeColor,
          border: `1px solid ${typeColor}40`,
        }}
      >
        {task.taskType || 'TYPE'}
        <ChevronDown className="h-2 w-2" />
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[90px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          {TASK_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => { onUpdate(task.id, { taskType: type }); setShow(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-800"
              style={{ color: TASK_TYPE_COLORS[type] }}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: TASK_TYPE_COLORS[type] }} />
              {type}
            </button>
          ))}
        </div>
      )}
    </div>
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

// ─── Caption Preview (compact inline) ────────────────────────────────────────

export function CaptionPreview({
  fields,
  typeColor,
}: {
  fields: Record<string, string>;
  typeColor: string;
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
        <span className="text-[10px] font-mono truncate text-gray-700 dark:text-gray-300">
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
      </div>
    </div>
  );
}

// ─── Flyer Preview (compact inline) ──────────────────────────────────────────

export function FlyerPreview({
  fields,
}: {
  fields: Record<string, string>;
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
          <span className="text-[9px] font-mono truncate text-brand-blue">
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
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`p-0.5 rounded transition-colors ${
        flagged
          ? 'text-amber-500 hover:bg-amber-500/10'
          : 'text-gray-400 dark:text-gray-700 hover:text-amber-500 hover:bg-amber-500/10'
      }`}
      title={flagged ? 'Caption flagged — replacement queued' : 'Flag: caption needs replacement'}
    >
      <Flag className="h-2.5 w-2.5" fill={flagged ? 'currentColor' : 'none'} />
    </button>
  );
}
