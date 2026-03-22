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
} from 'lucide-react';
import {
  SchedulerTask,
  TASK_FIELD_DEFS,
  TaskFields,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPES, TASK_TYPE_COLORS } from './task-cards/shared';
import { formatTimeInTz, formatDuration } from '@/lib/scheduler/time-helpers';
import { CaptionPicker } from './pickers/CaptionPicker';
import { FlyerPicker } from './pickers/FlyerPicker';

const TASK_TYPE_TO_CAPTION_CATEGORY: Record<string, string> = {
  MM: 'MM Unlock',
  WP: 'Wall Post',
  SP: 'Sub Promo',
};

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

interface SchedulerTaskModalProps {
  task: SchedulerTask;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  onDelete?: (id: string) => void;
}

export function SchedulerTaskModal({
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
}: SchedulerTaskModalProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [pickerTab, setPickerTab] = useState<'caption' | 'flyer'>('caption');
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const typeColor = TASK_TYPE_COLORS[task.taskType] || '#3a3a5a';
  const fieldDefs = TASK_FIELD_DEFS[task.taskType] || [];
  const serverFields = (task.fields || {}) as Record<string, string>;

  // ─── Local picker state (survives refetches) ───
  const [localPicker, setLocalPicker] = useState({
    captionId: serverFields.captionId || '',
    captionBankText: serverFields.captionBankText || '',
    caption: serverFields.caption || '',
    flyerAssetId: serverFields.flyerAssetId || '',
    flyerAssetUrl: serverFields.flyerAssetUrl || '',
  });

  // Sync from server only when modal opens with a new task
  const lastTaskIdRef = useRef(task.id);
  useEffect(() => {
    if (lastTaskIdRef.current !== task.id) {
      lastTaskIdRef.current = task.id;
      setLocalPicker({
        captionId: serverFields.captionId || '',
        captionBankText: serverFields.captionBankText || '',
        caption: serverFields.caption || '',
        flyerAssetId: serverFields.flyerAssetId || '',
        flyerAssetUrl: serverFields.flyerAssetUrl || '',
      });
    }
  }, [task.id]);

  // Merge local picker state with server fields for display
  const fields = { ...serverFields, ...localPicker };

  // Helper: save fields to server
  const saveFields = useCallback((patch: Record<string, string>) => {
    const merged = { ...serverFields, ...localPicker, ...patch } as TaskFields;
    onUpdate(task.id, { fields: merged });
  }, [serverFields, localPicker, task.id, onUpdate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setShowTypeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleStatusChange = useCallback((newStatus: string) => {
    const updates: Partial<SchedulerTask> = { status: newStatus as SchedulerTask['status'] };
    if (newStatus === 'IN_PROGRESS' && !task.startTime) updates.startTime = new Date().toISOString();
    if (newStatus === 'DONE' && task.startTime && !task.endTime) updates.endTime = new Date().toISOString();
    onUpdate(task.id, updates);
    setShowStatusMenu(false);
  }, [task, onUpdate]);

  const handleFieldBlur = useCallback((key: string, val: string) => {
    const currentVal = fields[key] || '';
    if (val.trim() !== currentVal) {
      saveFields({ [key]: val.trim() });
    }
  }, [fields, saveFields]);

  const handleSelectCaption = useCallback((captionId: string, text: string) => {
    const patch = { captionId, captionBankText: text, caption: text };
    setLocalPicker((prev) => ({ ...prev, ...patch }));
    saveFields(patch);
  }, [saveFields]);

  const handleClearCaption = useCallback(() => {
    const patch = { captionId: '', captionBankText: '' };
    setLocalPicker((prev) => ({ ...prev, ...patch }));
    saveFields(patch);
  }, [saveFields]);

  const handleCaptionOverride = useCallback((text: string) => {
    const patch = { caption: text, captionId: '', captionBankText: '' };
    setLocalPicker((prev) => ({ ...prev, ...patch }));
    saveFields(patch);
  }, [saveFields]);

  const handleSelectFlyer = useCallback((assetId: string, url: string) => {
    const patch = { flyerAssetId: assetId, flyerAssetUrl: url };
    setLocalPicker((prev) => ({ ...prev, ...patch }));
    saveFields(patch);
  }, [saveFields]);

  const handleClearFlyer = useCallback(() => {
    const patch = { flyerAssetId: '', flyerAssetUrl: '' };
    setLocalPicker((prev) => ({ ...prev, ...patch }));
    saveFields(patch);
  }, [saveFields]);

  const handleFlyerOverrideUrl = useCallback((url: string) => {
    const patch = { flyerAssetUrl: url, flyerAssetId: '' };
    setLocalPicker((prev) => ({ ...prev, ...patch }));
    saveFields(patch);
  }, [saveFields]);

  if (!open) return null;

  const statusOpt = STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-xl border bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#1a1a2e] shadow-2xl max-h-[90vh] flex flex-col"
        style={{ borderTopWidth: 3, borderTopColor: typeColor }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#111124]">
          <div className="flex items-center gap-2">
            {/* Type selector */}
            <div className="relative" ref={typeMenuRef}>
              <button
                onClick={() => setShowTypeMenu(!showTypeMenu)}
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans transition-colors border"
                style={{
                  background: typeColor + '20',
                  color: typeColor,
                  border: `1px solid ${typeColor}40`,
                }}
              >
                {task.taskType || 'TYPE'}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              {showTypeMenu && (
                <div className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[90px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
                  {TASK_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => { onUpdate(task.id, { taskType: type }); setShowTypeMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-800"
                      style={{ color: TASK_TYPE_COLORS[type] }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: TASK_TYPE_COLORS[type] }} />
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                {STATUS_ICONS[task.status]}
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
          </div>

          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={() => { onDelete(task.id); onClose(); }}
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

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Field rows */}
          <div className="px-4 py-3 space-y-2">
            {fieldDefs.filter((def) => def.key !== 'caption' || !TYPES_WITH_PICKER.has(task.taskType)).map((def) => (
              <ModalFieldRow
                key={def.key}
                label={def.label}
                value={fields[def.key] || ''}
                placeholder={def.placeholder}
                onBlur={(val) => handleFieldBlur(def.key, val)}
              />
            ))}

            {/* Legacy taskName fallback */}
            {fieldDefs.length === 0 && task.taskName && (
              <div className="text-xs font-mono text-gray-600 dark:text-gray-400 py-1">
                {task.taskName}
              </div>
            )}
          </div>

          {/* Caption & Flyer Picker Section */}
          {TYPES_WITH_PICKER.has(task.taskType) && (
            <div className="mx-4 mb-3 border rounded-lg overflow-hidden border-gray-200 dark:border-[#111124]">
              {/* Picker tabs */}
              <div className="flex border-b border-gray-200 dark:border-[#111124] bg-gray-50 dark:bg-[#090912]">
                {(['caption', 'flyer'] as const).map((tab) => {
                  const active = pickerTab === tab;
                  const hasFlaggedCaption = fields.captionId && fields.flagged;
                  return (
                    <button
                      key={tab}
                      onClick={() => setPickerTab(tab)}
                      className="flex-1 py-2 text-[11px] font-bold font-sans transition-all border-b-2"
                      style={{
                        color: active ? typeColor : '#252545',
                        borderBottomColor: active ? typeColor : 'transparent',
                      }}
                    >
                      {tab === 'caption'
                        ? `Caption${hasFlaggedCaption ? ' 🚩' : ''}`
                        : 'Preview GIF'}
                    </button>
                  );
                })}
              </div>

              {/* Picker content */}
              <div className="p-3">
                {pickerTab === 'caption' ? (
                  <CaptionPicker
                    profileId={task.profileId}
                    captionCategory={TASK_TYPE_TO_CAPTION_CATEGORY[task.taskType] || 'MM Unlock'}
                    selectedCaptionId={fields.captionId || null}
                    captionOverride={fields.captionId ? '' : (fields.caption || '')}
                    onSelectCaption={handleSelectCaption}
                    onClearCaption={handleClearCaption}
                    onOverrideChange={handleCaptionOverride}
                    typeColor={typeColor}
                  />
                ) : (
                  <FlyerPicker
                    profileId={task.profileId}
                    selectedFlyerAssetId={fields.flyerAssetId || null}
                    selectedFlyerUrl={fields.flyerAssetUrl || ''}
                    onSelectFlyer={handleSelectFlyer}
                    onClearFlyer={handleClearFlyer}
                    onOverrideUrl={handleFlyerOverrideUrl}
                    typeColor={typeColor}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: time info + updated by */}
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-[#111124] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.startTime && (
              <div className="flex items-center gap-1 text-[9px] font-mono text-gray-500 dark:text-gray-600">
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
              </div>
            )}
          </div>
          {task.updatedBy && (
            <span className="text-[8px] font-mono text-gray-400 dark:text-gray-700 truncate">
              updated by {task.updatedBy}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModalFieldRow({
  label,
  value,
  placeholder,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onBlur: (val: string) => void;
}) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <label className="text-[10px] font-bold text-gray-400 dark:text-gray-600 font-sans min-w-[90px] whitespace-nowrap">
        {label}
      </label>
      <input
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => onBlur(localVal)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder={placeholder}
        className="flex-1 text-xs px-2 py-1 rounded border outline-none font-mono transition-colors bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue dark:bg-[#090912] dark:border-[#1a1a2e] dark:text-gray-300 dark:focus:border-[#38bdf8]"
      />
    </div>
  );
}
