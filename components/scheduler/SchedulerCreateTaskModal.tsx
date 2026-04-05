'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  TASK_FIELD_DEFS,
  TaskFields,
  SchedulerTask,
  MM_SUB_TYPE_ICONS,
  WP_SUB_TYPE_ICONS,
  FOLLOW_UP_SUB_TYPES,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS } from './task-cards/shared';
import { CaptionPicker, type CaptionSelection } from './pickers/CaptionPicker';

// ─── Constants ──────────────────────────────────────────────────────────────

const MULTILINE_KEYS = new Set([
  'caption', 'captionGuide', 'paywallContent', 'contentPreview', 'contentFlyer',
]);

const TYPES_WITH_PICKER = new Set(['MM', 'WP', 'SP']);

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

/** Required field keys by task type. Fields not listed here are optional at creation. */
function getRequiredFieldKeys(taskType: string, mmSubType?: string): string[] {
  if (taskType === 'MM') {
    if (mmSubType === 'Unlock') {
      return ['type', 'time', 'contentPreview', 'paywallContent', 'tag', 'caption', 'price'];
    }
    // Follow Up, Photo Bump — only type + time required
    return ['type', 'time'];
  }
  if (taskType === 'WP') return ['type', 'time', 'caption'];
  if (taskType === 'ST') return ['storyPostSchedule'];
  if (taskType === 'SP') return ['type', 'time', 'caption'];
  return [];
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface SchedulerCreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreateTask: (dayOfWeek: number, taskType: string, fields: TaskFields, lineageId?: string | null) => Promise<SchedulerTask>;
  onTaskCreated?: (task: SchedulerTask) => void;
  dayIndex: number;
  taskType: string;
  initialFields?: TaskFields;
  date: Date;
  profileId?: string | null;
  dayTasks?: SchedulerTask[];
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SchedulerCreateTaskModal({
  open,
  onClose,
  onCreateTask,
  onTaskCreated,
  dayIndex,
  taskType,
  initialFields,
  date,
  profileId,
  dayTasks = [],
}: SchedulerCreateTaskModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [showCaptionPicker, setShowCaptionPicker] = useState(false);
  const [selectedSiblingId, setSelectedSiblingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Initialize fields from initialFields on open
  useEffect(() => {
    if (open) {
      if (initialFields) {
        const init: Record<string, string> = {};
        for (const [k, v] of Object.entries(initialFields)) {
          if (v != null) init[k] = String(v);
        }
        setFields(init);
      } else {
        setFields({});
      }
      setShowCaptionPicker(false);
      setSelectedSiblingId(null);
    }
  }, [open, initialFields]);

  // ─── Sibling Unlock picker for Follow Up / Photo Bump ───
  const preFilledType = (initialFields as Record<string, string> | undefined)?.type;
  const isFollowUpOrBump = taskType === 'MM' && (preFilledType === 'Follow Up' || preFilledType === 'Photo Bump');

  const unlockTasks = useMemo(() => {
    if (!isFollowUpOrBump) return [];
    return dayTasks.filter((t) => {
      if (t.taskType !== 'MM') return false;
      const f = (t.fields || {}) as Record<string, string>;
      return (f.type || t.taskName || '').toLowerCase().includes('unlock');
    });
  }, [isFollowUpOrBump, dayTasks]);

  const selectedSibling = useMemo(
    () => unlockTasks.find((t) => t.id === selectedSiblingId) ?? null,
    [unlockTasks, selectedSiblingId],
  );

  const typeColor = TASK_TYPE_COLORS[taskType] || '#3a3a5a';
  const fieldDefs = TASK_FIELD_DEFS[taskType] || [];
  const mmSubType = taskType === 'MM' ? preFilledType : undefined;

  const requiredKeys = useMemo(
    () => getRequiredFieldKeys(taskType, mmSubType),
    [taskType, mmSubType],
  );

  // Keys to hide from editable rows — shown as chips or not relevant at creation
  const hiddenKeys = useMemo(() => {
    const hidden = new Set(['finalAmount']);
    // Pre-filled type shown as chip, not as input
    if (preFilledType) hidden.add('type');
    // subType from initialFields shown as chip
    if ((initialFields as Record<string, string> | undefined)?.subType) hidden.add('subType');
    return hidden;
  }, [preFilledType, initialFields]);

  const editableFieldDefs = useMemo(
    () => fieldDefs.filter((d) => !hiddenKeys.has(d.key)),
    [fieldDefs, hiddenKeys],
  );

  const handleFieldChange = useCallback((key: string, val: string) => {
    setFields((prev) => ({ ...prev, [key]: val }));
  }, []);

  // ─── Caption picker integration ───

  const handleSelectCaption = useCallback((selection: CaptionSelection) => {
    setFields((prev) => {
      const next: Record<string, string> = {
        ...prev,
        caption: selection.captionText,
        captionId: selection.captionId,
        captionBankText: selection.captionText,
      };
      if (selection.price && taskType === 'MM') {
        next.price = `$${selection.price.toFixed(2)}`;
      }
      if (selection.gifUrl) {
        next.contentPreview = selection.gifUrl;
      }
      if (selection.contentType) {
        next.tag = selection.contentType;
      }
      if (selection.contentCount) {
        next.paywallContent = selection.contentLength
          ? `${selection.contentCount} (${selection.contentLength})`
          : selection.contentCount;
      }
      if (selection.sextingSetName) {
        next.folderName = selection.sextingSetName;
      }
      return next;
    });
  }, [taskType]);

  const handleClearCaption = useCallback(() => {
    setFields((prev) => {
      const next = { ...prev };
      delete next.captionId;
      delete next.captionBankText;
      next.caption = '';
      next.contentPreview = '';
      next.tag = '';
      next.paywallContent = '';
      next.price = '';
      next.folderName = '';
      return next;
    });
  }, []);

  // ─── Validation ───

  const missingFields = useMemo(() => {
    return requiredKeys.filter((key) => {
      // Pre-filled type always satisfies the requirement
      if (key === 'type' && preFilledType) return false;
      return !fields[key]?.trim();
    });
  }, [requiredKeys, fields, preFilledType]);

  const canCreate = missingFields.length === 0;

  const handleCreate = useCallback(async () => {
    if (!canCreate || isCreating) return;
    const missing = missingFields;
    if (missing.length > 0) {
      const labels = missing.map((key) => {
        const def = fieldDefs.find((d) => d.key === key);
        return def?.label || key;
      });
      toast.error(`Missing required fields: ${labels.join(', ')}`);
      return;
    }
    setIsCreating(true);
    try {
      const siblingLineageId = selectedSibling?.lineageId ?? null;
      const created = await onCreateTask(dayIndex, taskType, fields as TaskFields, siblingLineageId);
      onClose();
      // Signal parent to directly open the newly created task's modal
      if (created?.id) {
        onTaskCreated?.(created);
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsCreating(false);
    }
  }, [canCreate, isCreating, missingFields, fieldDefs, fields, dayIndex, taskType, onCreateTask, onClose, selectedSibling, onTaskCreated]);

  // Close on Escape (but not while creating)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, isCreating]);

  if (!open) return null;

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current && !isCreating) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg mx-4 max-h-[85vh] flex flex-col rounded-xl border shadow-2xl bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#1a1a2e]"
        style={{ borderTopWidth: 3, borderTopColor: typeColor }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#111124]">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Task type badge */}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full font-sans"
              style={{
                background: typeColor + '18',
                color: typeColor,
                border: `1px solid ${typeColor}40`,
              }}
            >
              {taskType}
            </span>
            {/* Pre-filled type chip */}
            {preFilledType && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full font-sans flex items-center gap-1"
                style={{
                  background: typeColor + '10',
                  color: typeColor,
                  border: `1px solid ${typeColor}25`,
                }}
              >
                {taskType === 'MM' && MM_SUB_TYPE_ICONS[preFilledType] && (
                  <span className="text-[10px]">{MM_SUB_TYPE_ICONS[preFilledType]}</span>
                )}
                {taskType === 'WP' && WP_SUB_TYPE_ICONS[preFilledType] && (
                  <span className="text-[10px]">{WP_SUB_TYPE_ICONS[preFilledType]}</span>
                )}
                {preFilledType}
              </span>
            )}
            <span className="text-xs font-mono text-gray-400 dark:text-gray-600">
              {dateStr}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* ── Body — scrollable ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Sibling Unlock picker — shown for Follow Up / Photo Bump */}
          {isFollowUpOrBump && unlockTasks.length > 0 && (
            <div>
              <label className="text-[10px] font-bold font-sans text-gray-400 dark:text-gray-600 flex items-center gap-1.5 mb-1.5">
                <Link2 className="h-3 w-3" />
                Link to Unlock
              </label>
              <div className="space-y-1">
                {unlockTasks.map((ut) => {
                  const f = (ut.fields || {}) as Record<string, string>;
                  const isSelected = selectedSiblingId === ut.id;
                  return (
                    <button
                      key={ut.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSiblingId(null);
                        } else {
                          setSelectedSiblingId(ut.id);
                          // Copy relevant fields from the Unlock
                          setFields((prev) => {
                            const updates: Record<string, string> = {};
                            if (f.subType) updates.subType = f.subType;
                            if (f.contentPreview) {
                              updates.contentPreview = f.contentPreview;
                            } else {
                              // No content/preview → auto-set style to No Flyer
                              updates.subType = 'No Flyer ⬆';
                            }
                            return { ...prev, ...updates };
                          });
                        }
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-brand-blue/50 bg-brand-blue/5 dark:border-[#38bdf8]/40 dark:bg-[#38bdf8]/5'
                          : 'border-gray-200 hover:border-gray-300 dark:border-[#1a1a2e] dark:hover:border-[#333]'
                      }`}
                    >
                      <span className="text-[10px]">🔓</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold font-sans text-gray-700 dark:text-gray-300 truncate">
                          {f.time && <span className="font-mono text-gray-500 dark:text-gray-500 mr-1.5">{f.time}</span>}
                          Unlock
                          {f.tag && <span className="text-gray-400 dark:text-gray-600 ml-1.5">· {f.tag}</span>}
                        </div>
                        {f.caption && (
                          <div className="text-[9px] font-mono text-gray-400 dark:text-gray-600 truncate mt-0.5">
                            {f.caption.slice(0, 80)}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-brand-blue/15 text-brand-blue dark:bg-[#38bdf8]/15 dark:text-[#38bdf8] shrink-0">
                          Linked
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {isFollowUpOrBump && unlockTasks.length === 0 && (
            <div className="text-[10px] font-mono text-gray-400 dark:text-gray-600 italic px-1">
              No Unlock tasks on this day to link with
            </div>
          )}

          {/* Editable field rows */}
          {editableFieldDefs.map((def) => {
            const isRequired = requiredKeys.includes(def.key);
            const isCurrencyField = def.key === 'price' || def.key === 'priceInfo';
            // Skip caption row if we're showing the picker section below
            if (def.key === 'caption' && TYPES_WITH_PICKER.has(taskType)) return null;

            // subType (Style) renders as a dropdown for MM tasks
            if (def.key === 'subType' && taskType === 'MM') {
              return (
                <CreateDropdownRow
                  key={def.key}
                  label={def.label}
                  value={fields[def.key] || ''}
                  options={FOLLOW_UP_SUB_TYPES as unknown as string[]}
                  placeholder="Select style..."
                  onChange={(val) => handleFieldChange(def.key, val)}
                  required={isRequired}
                />
              );
            }

            return (
              <CreateFieldRow
                key={def.key}
                fieldKey={def.key}
                label={def.label}
                value={fields[def.key] || ''}
                placeholder={def.placeholder}
                onChange={(val) => handleFieldChange(def.key, val)}
                required={isRequired}
                currency={isCurrencyField}
              />
            );
          })}

          {/* Caption Picker section (MM, WP, SP) */}
          {TYPES_WITH_PICKER.has(taskType) && (
            <div
              className="border rounded-lg overflow-hidden"
              style={{ borderColor: typeColor + '25' }}
            >
              <button
                onClick={() => setShowCaptionPicker(!showCaptionPicker)}
                className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold font-sans" style={{ color: typeColor }}>
                    Caption
                  </span>
                  {requiredKeys.includes('caption') && (
                    <span className="text-red-400 text-[10px] font-bold">*</span>
                  )}
                  {fields.caption && (
                    <span className="text-[9px] font-mono text-gray-400 dark:text-gray-600 truncate max-w-[200px]">
                      {fields.caption.slice(0, 60)}{fields.caption.length > 60 ? '...' : ''}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold font-sans shrink-0" style={{ color: typeColor }}>
                  {showCaptionPicker ? 'Hide' : 'Select'}
                </span>
              </button>
              {showCaptionPicker && (
                <div className="px-3 pb-3 border-t border-gray-100 dark:border-[#111124] pt-2">
                  {/* Manual caption input at top if no picker profile */}
                  <CaptionPicker
                    profileId={profileId ?? null}
                    captionCategory={getCaptionCategory(taskType, preFilledType)}
                    selectedCaptionId={fields.captionId || null}
                    captionOverride={fields.caption || ''}
                    onSelectCaption={handleSelectCaption}
                    onClearCaption={handleClearCaption}
                    onOverrideChange={(text) => handleFieldChange('caption', text)}
                    typeColor={typeColor}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-[#111124]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1.5"
            style={{ background: canCreate && !isCreating ? typeColor : typeColor + '60' }}
          >
            {isCreating ? (
              <>
                <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Task'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Create Field Row ─────────────────────────────────────────────────────────

function CreateFieldRow({
  fieldKey,
  label,
  value,
  placeholder,
  onChange,
  required,
  currency,
}: {
  fieldKey: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  required?: boolean;
  currency?: boolean;
}) {
  const multiline = MULTILINE_KEYS.has(fieldKey);
  const [localVal, setLocalVal] = useState(currency ? value.replace(/^\$/, '').trim() : value);

  useEffect(() => {
    setLocalVal(currency ? value.replace(/^\$/, '').trim() : value);
  }, [value, currency]);

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

  const inputClasses =
    'flex-1 text-xs py-1.5 rounded border outline-none font-mono transition-colors ' +
    'bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue ' +
    'dark:bg-[#090912] dark:border-[#1a1a2e] dark:text-gray-300 dark:focus:border-[#38bdf8]';

  return (
    <div className={`flex ${multiline ? 'items-start' : 'items-center'} gap-3`}>
      <label
        className={`text-[10px] font-bold font-sans min-w-[90px] whitespace-nowrap ${
          multiline ? 'pt-1.5' : ''
        } text-gray-400 dark:text-gray-600`}
      >
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {currency ? (
        <div className={`flex items-center ${inputClasses} px-0`}>
          <span className="text-xs font-mono pl-2 pr-0.5 text-gray-400 dark:text-gray-500">$</span>
          <input
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="0.00"
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
          rows={3}
          className={`${inputClasses} px-2.5 resize-y min-h-[60px]`}
        />
      ) : (
        <input
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder={placeholder}
          className={`${inputClasses} px-2.5`}
        />
      )}
    </div>
  );
}

// ─── Dropdown Row (for subType / Style) ───────────────────────────────────────

function CreateDropdownRow({
  label,
  value,
  options,
  placeholder,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (val: string) => void;
  required?: boolean;
}) {
  const selectClasses =
    'flex-1 text-xs py-1.5 px-2.5 rounded border outline-none font-mono transition-colors appearance-none cursor-pointer ' +
    'bg-gray-50 border-gray-200 text-gray-800 focus:border-brand-blue ' +
    'dark:bg-[#090912] dark:border-[#1a1a2e] dark:text-gray-300 dark:focus:border-[#38bdf8]';

  return (
    <div className="flex items-center gap-3">
      <label className="text-[10px] font-bold font-sans min-w-[90px] whitespace-nowrap text-gray-400 dark:text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClasses}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
