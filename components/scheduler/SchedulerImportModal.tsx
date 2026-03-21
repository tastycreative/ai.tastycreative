'use client';

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, FileSpreadsheet, Loader2, Trash2, CheckCircle2, AlertCircle, Pencil, Check } from 'lucide-react';
import {
  useParseSchedulerSheet,
  useImportSchedulerTasks,
  TASK_FIELD_DEFS,
  type ParsedTask,
  type ImportMode,
} from '@/lib/hooks/useScheduler.query';
import { TASK_TYPE_COLORS } from './SchedulerTaskCard';
import { SLOT_TO_DAY } from '@/lib/scheduler/sheet-parser';

const SLOTS = ['1A', '1B', '1C', '1D', '1E', '1F', '1G'] as const;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const IMPORT_MODES: { key: ImportMode; label: string; desc: string }[] = [
  { key: 'replace', label: 'Replace All', desc: 'Remove all existing tasks for this week, then import' },
  { key: 'append', label: 'Append', desc: 'Keep existing tasks, add imported ones after them' },
  { key: 'replace_by_type', label: 'Replace by Type', desc: 'Only replace tasks whose type (MM/WP/ST/SP) is in the import' },
];

type Phase = 'input' | 'preview' | 'importing' | 'done';

interface SchedulerImportModalProps {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  platform: string;
  profileId: string | null;
}

export function SchedulerImportModal({
  open,
  onClose,
  weekStart,
  platform,
  profileId,
}: SchedulerImportModalProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [sheetUrl, setSheetUrl] = useState('');
  const [slots, setSlots] = useState<Record<string, ParsedTask[]>>({});
  const [activeSlot, setActiveSlot] = useState<string>('1A');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<ImportMode | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; deleted: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ slot: string; taskIdx: number; fieldKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const parseMutation = useParseSchedulerSheet();
  const importMutation = useImportSchedulerTasks();

  const handleParse = useCallback(async () => {
    if (!sheetUrl.trim()) return;
    try {
      const result = await parseMutation.mutateAsync(sheetUrl.trim());
      setSlots(result.slots);
      setParseErrors(result.errors ?? []);
      const firstSlot = SLOTS.find((s) => result.slots[s]?.length);
      setActiveSlot(firstSlot ?? '1A');
      setPhase('preview');
    } catch {
      // Error handled by mutation state
    }
  }, [sheetUrl, parseMutation]);

  const handleDeleteTask = useCallback((slot: string, taskIdx: number) => {
    setSlots((prev) => {
      const tasks = [...(prev[slot] ?? [])];
      tasks.splice(taskIdx, 1);
      const next = { ...prev };
      if (tasks.length === 0) {
        delete next[slot];
      } else {
        next[slot] = tasks;
      }
      return next;
    });
  }, []);

  const startEdit = useCallback((slot: string, taskIdx: number, fieldKey: string, currentValue: string) => {
    setEditingCell({ slot, taskIdx, fieldKey });
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const { slot, taskIdx, fieldKey } = editingCell;
    setSlots((prev) => {
      const tasks = [...(prev[slot] ?? [])];
      const task = { ...tasks[taskIdx] };
      task.fields = { ...task.fields, [fieldKey]: editValue };
      tasks[taskIdx] = task;
      return { ...prev, [slot]: tasks };
    });
    setEditingCell(null);
  }, [editingCell, editValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const totalTasks = Object.values(slots).reduce((sum, tasks) => sum + tasks.length, 0);

  const handleImport = useCallback(async () => {
    setPhase('importing');
    setImportError(null);

    const allTasks: {
      dayOfWeek: number;
      taskType: string;
      taskName: string;
      fields: Record<string, string>;
      sortOrder: number;
    }[] = [];

    for (const [slot, tasks] of Object.entries(slots)) {
      const dayOfWeek = SLOT_TO_DAY[slot] ?? 0;
      tasks.forEach((task, idx) => {
        allTasks.push({
          dayOfWeek,
          taskType: task.taskType,
          taskName: task.taskName,
          fields: task.fields,
          sortOrder: idx,
        });
      });
    }

    try {
      const result = await importMutation.mutateAsync({
        weekStart,
        platform,
        profileId,
        mode: importMode!,
        tasks: allTasks,
      });
      setImportResult(result);
      setPhase('done');
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setPhase('preview');
    }
  }, [slots, weekStart, platform, profileId, importMode, importMutation]);

  const handleClose = useCallback(() => {
    setPhase('input');
    setSheetUrl('');
    setSlots({});
    setParseErrors([]);
    setImportMode(null);
    setImportResult(null);
    setImportError(null);
    setEditingCell(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const activeTasks = slots[activeSlot] ?? [];
  const fieldDefs = TASK_FIELD_DEFS;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col bg-white dark:bg-[#0c0c1a] border border-gray-200 dark:border-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-[#1a1a2e]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-4 w-4 text-brand-light-pink" />
            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Import from Google Sheet
            </span>
            {phase === 'preview' && (
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600 ml-2">
                {totalTasks} tasks found
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Phase: Input ── */}
          {phase === 'input' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste a public Google Sheets URL. The sheet should have tabs named
                &quot;Schedule #1A&quot; through &quot;Schedule #1G&quot; (one per day of the week).
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                  Google Sheet URL
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0a0a14] border border-gray-200 dark:border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-brand-light-pink/40 focus:border-brand-light-pink outline-none text-gray-900 dark:text-zinc-200 placeholder:text-gray-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleParse()}
                  autoFocus
                />
              </div>

              {parseMutation.isError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {parseMutation.error?.message}
                  </p>
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={!sheetUrl.trim() || parseMutation.isPending}
                className="w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 bg-brand-light-pink text-white hover:bg-brand-mid-pink disabled:hover:bg-brand-light-pink"
              >
                {parseMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing sheet...
                  </span>
                ) : (
                  'Parse Schedule'
                )}
              </button>
            </div>
          )}

          {/* ── Phase: Preview ── */}
          {phase === 'preview' && (
            <div className="space-y-4">
              {importError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    {parseErrors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Import mode selector — required */}
              <div className={`rounded-xl border-2 p-3.5 space-y-2.5 transition-colors ${
                importMode === null
                  ? 'border-amber-400/60 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5'
                  : 'border-gray-200 dark:border-[#1a1a2e] bg-transparent'
              }`}>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-200">
                    How should existing tasks be handled?
                  </label>
                  {importMode === null && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 animate-pulse">
                      REQUIRED
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {IMPORT_MODES.map((m) => {
                    const isSelected = importMode === m.key;
                    const isDestructive = m.key === 'replace';
                    return (
                      <button
                        key={m.key}
                        onClick={() => setImportMode(m.key)}
                        className={`flex items-start gap-3 text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                          isSelected
                            ? isDestructive
                              ? 'bg-red-50 dark:bg-red-500/10 border-red-400/50 dark:border-red-500/40'
                              : 'bg-brand-light-pink/10 border-brand-light-pink/40'
                            : 'bg-gray-50/50 dark:bg-[#0a0a14]/50 border-gray-100 dark:border-[#151528] hover:border-gray-300 dark:hover:border-[#2a2a4e]'
                        }`}
                      >
                        {/* Radio circle */}
                        <div className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? isDestructive
                              ? 'border-red-500'
                              : 'border-brand-light-pink'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && (
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              isDestructive ? 'bg-red-500' : 'bg-brand-light-pink'
                            }`} />
                          )}
                        </div>
                        <div>
                          <span className={`text-[11px] font-bold ${
                            isSelected
                              ? isDestructive
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-brand-light-pink'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {m.label}
                          </span>
                          <p className={`text-[10px] mt-0.5 ${
                            isSelected ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {m.desc}
                          </p>
                          {isSelected && isDestructive && (
                            <p className="text-[10px] mt-1 font-semibold text-red-500 dark:text-red-400">
                              Warning: This will permanently delete all existing tasks for this week.
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {SLOTS.map((slot) => {
                  const count = slots[slot]?.length ?? 0;
                  const isActive = activeSlot === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => setActiveSlot(slot)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                        isActive
                          ? 'bg-brand-light-pink/15 text-brand-light-pink border-brand-light-pink/30'
                          : count > 0
                            ? 'bg-gray-50 dark:bg-[#0a0a14] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#1a1a2e] hover:border-gray-300 dark:hover:border-[#2a2a4e]'
                            : 'bg-transparent text-gray-300 dark:text-gray-700 border-transparent cursor-default'
                      }`}
                      disabled={count === 0}
                    >
                      {slot}
                      <span className="ml-1 text-[9px] font-mono opacity-70">
                        {DAY_NAMES[SLOT_TO_DAY[slot]]}
                      </span>
                      {count > 0 && (
                        <span className="ml-1.5 text-[9px] font-mono">
                          ({count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Task list for active slot */}
              {activeTasks.length > 0 ? (
                <div className="space-y-2">
                  {(['MM', 'WP', 'ST', 'SP'] as const).map((type) => {
                    const typeTasks = activeTasks
                      .map((t, i) => ({ ...t, _idx: i }))
                      .filter((t) => t.taskType === type);
                    if (typeTasks.length === 0) return null;

                    const color = TASK_TYPE_COLORS[type] ?? '#888';
                    const defs = fieldDefs[type] ?? [];

                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: color + '20',
                              color: color,
                            }}
                          >
                            {type}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {typeTasks.length} task{typeTasks.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {typeTasks.map((task) => (
                            <div
                              key={task._idx}
                              className="group relative rounded-lg border border-gray-100 dark:border-[#151528] bg-gray-50/50 dark:bg-[#0a0a14]/50 p-2.5"
                            >
                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteTask(activeSlot, task._idx)}
                                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                                title="Remove task"
                              >
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </button>

                              {/* Fields */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pr-6">
                                {defs.map((def) => {
                                  const value = task.fields[def.key] ?? '';
                                  if (!value) return null;

                                  const isEditing =
                                    editingCell?.slot === activeSlot &&
                                    editingCell?.taskIdx === task._idx &&
                                    editingCell?.fieldKey === def.key;

                                  return (
                                    <div key={def.key} className="flex items-start gap-1.5 min-w-0">
                                      <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-600 shrink-0 mt-0.5 w-20 text-right">
                                        {def.label}
                                      </span>
                                      {isEditing ? (
                                        <div className="flex items-center gap-1 flex-1 min-w-0">
                                          <input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') commitEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 bg-white dark:bg-[#0c0c1a] border border-brand-light-pink/50 rounded outline-none text-gray-900 dark:text-zinc-200"
                                            autoFocus
                                          />
                                          <button
                                            onClick={commitEdit}
                                            className="p-0.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"
                                          >
                                            <Check className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={cancelEdit}
                                            className="p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span
                                          className="text-[11px] text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-brand-light-pink transition-colors group/edit flex items-center gap-1 min-w-0"
                                          onClick={() => startEdit(activeSlot, task._idx, def.key, value)}
                                          title="Click to edit"
                                        >
                                          <span className="truncate">{value}</span>
                                          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/edit:opacity-50 shrink-0" />
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-600">
                  No tasks found for {activeSlot} ({DAY_NAMES[SLOT_TO_DAY[activeSlot]]})
                </div>
              )}
            </div>
          )}

          {/* ── Phase: Importing ── */}
          {phase === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-brand-light-pink" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Importing {totalTasks} tasks...
              </p>
            </div>
          )}

          {/* ── Phase: Done ── */}
          {phase === 'done' && importResult && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                  Import Complete
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Successfully imported {importResult.imported} tasks into the scheduler.
                  {importResult.deleted > 0 && (
                    <span className="block mt-0.5 text-amber-500">
                      {importResult.deleted} existing task{importResult.deleted !== 1 ? 's were' : ' was'} removed.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-[#1a1a2e] flex items-center justify-between">
          {phase === 'preview' && (
            <>
              <button
                onClick={() => {
                  setPhase('input');
                  setSlots({});
                  setParseErrors([]);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={totalTasks === 0 || importMode === null}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-light-pink text-white hover:bg-brand-mid-pink disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title={importMode === null ? 'Select an import mode first' : undefined}
                >
                  Import All ({totalTasks})
                </button>
              </div>
            </>
          )}

          {phase === 'done' && (
            <div className="ml-auto">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-light-pink text-white hover:bg-brand-mid-pink transition-all"
              >
                Close
              </button>
            </div>
          )}

          {(phase === 'input' || phase === 'importing') && <div />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
