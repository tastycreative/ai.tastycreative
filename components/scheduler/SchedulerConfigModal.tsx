'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useUpdatePodConfig, SchedulerConfig, TaskLimits } from '@/lib/hooks/useScheduler.query';
import { tabId } from '@/lib/hooks/useSchedulerRealtime';
import { cleanTaskLimits } from '@/lib/scheduler/task-limits';
import { TASK_TYPES, TASK_TYPE_COLORS } from './SchedulerTaskCard';
import { SLOT_LABELS } from '@/lib/scheduler/rotation';

interface SchedulerConfigModalProps {
  config: SchedulerConfig | null;
  open: boolean;
  onClose: () => void;
}

export function SchedulerConfigModal({ config, open, onClose }: SchedulerConfigModalProps) {
  const [teamNames, setTeamNames] = useState<string[]>(['']);
  const [offset, setOffset] = useState(0);
  const DEFAULT_LIMIT = '5';
  const [limitDefaults, setLimitDefaults] = useState<Record<string, string>>(
    () => Object.fromEntries(TASK_TYPES.map((t) => [t, DEFAULT_LIMIT])),
  );
  const [limitOverrides, setLimitOverrides] = useState<Record<string, Record<string, string>>>({});
  const updateConfig = useUpdatePodConfig();

  useEffect(() => {
    if (config) {
      setTeamNames(config.teamNames.length > 0 ? [...config.teamNames] : ['']);
      setOffset(config.rotationOffset);

      // Initialize task limits from config
      const tl = config.taskLimits;
      if (tl) {
        const defs: Record<string, string> = {};
        for (const [type, val] of Object.entries(tl.defaults ?? {})) {
          defs[type] = String(val);
        }
        setLimitDefaults(defs);

        const ovr: Record<string, Record<string, string>> = {};
        for (const [dayIdx, dayOverrides] of Object.entries(tl.overrides ?? {})) {
          ovr[dayIdx] = {};
          for (const [type, val] of Object.entries(dayOverrides)) {
            ovr[dayIdx][type] = String(val);
          }
        }
        setLimitOverrides(ovr);
      } else {
        setLimitDefaults(Object.fromEntries(TASK_TYPES.map((t) => [t, DEFAULT_LIMIT])));
        setLimitOverrides({});
      }
    } else {
      setTeamNames(['']);
      setOffset(0);
      setLimitDefaults(Object.fromEntries(TASK_TYPES.map((t) => [t, DEFAULT_LIMIT])));
      setLimitOverrides({});
    }
  }, [config, open]);

  if (!open) return null;

  const handleSave = async () => {
    const filtered = teamNames.map((n) => n.trim()).filter(Boolean);
    if (filtered.length === 0) return;

    // Build taskLimits from local state
    const defaults: Record<string, number> = {};
    for (const [type, val] of Object.entries(limitDefaults)) {
      const n = parseInt(val);
      if (!isNaN(n) && n > 0) defaults[type] = n;
    }

    const overrides: Record<string, Record<string, number>> = {};
    for (const [dayIdx, dayVals] of Object.entries(limitOverrides)) {
      const dayObj: Record<string, number> = {};
      for (const [type, val] of Object.entries(dayVals)) {
        const n = parseInt(val);
        if (!isNaN(n) && n > 0) dayObj[type] = n;
      }
      if (Object.keys(dayObj).length > 0) overrides[dayIdx] = dayObj;
    }

    const hasAnyLimits = Object.keys(defaults).length > 0 || Object.keys(overrides).length > 0;
    const taskLimits = hasAnyLimits
      ? cleanTaskLimits({ defaults, overrides })
      : null;

    await updateConfig.mutateAsync({
      teamNames: filtered,
      rotationOffset: offset,
      taskLimits,
      tabId,
    });
    onClose();
  };

  const addTeam = () => setTeamNames([...teamNames, '']);
  const removeTeam = (index: number) => {
    if (teamNames.length <= 1) return;
    setTeamNames(teamNames.filter((_, i) => i !== index));
  };
  const updateTeam = (index: number, value: string) => {
    const updated = [...teamNames];
    updated[index] = value;
    setTeamNames(updated);
  };

  const updateDefault = (type: string, value: string) => {
    setLimitDefaults((prev) => ({ ...prev, [type]: value }));
  };

  const updateOverride = (dayIndex: number, type: string, value: string) => {
    setLimitOverrides((prev) => ({
      ...prev,
      [String(dayIndex)]: { ...(prev[String(dayIndex)] ?? {}), [type]: value },
    }));
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/88">
      <div
        className="rounded-xl w-full max-w-lg mx-4 flex flex-col max-h-[92vh] overflow-y-auto bg-white border border-gray-200 dark:bg-[#0b0b1a] dark:border-[#111124]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#111124]">
          <h2 className="text-sm font-bold font-sans text-gray-900 dark:text-zinc-300">
            Task Limits
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4 text-gray-400 dark:text-[#555]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Team Names */}
          <div className="space-y-2">
            <label className="text-[9px] font-bold tracking-widest uppercase font-sans text-gray-500 dark:text-[#3a3a5a]">
              Team Names
            </label>
            {teamNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 dark:text-[#1e1e35]" />
                <input
                  value={name}
                  onChange={(e) => updateTeam(i, e.target.value)}
                  placeholder={`Team ${i + 1}`}
                  className="flex-1 px-3 py-2 text-xs rounded-md outline-none font-mono bg-gray-50 border border-gray-200 text-gray-900 dark:bg-[#07070f] dark:border-[#171730] dark:text-zinc-300"
                />
                <button
                  onClick={() => removeTeam(i)}
                  disabled={teamNames.length <= 1}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-20"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            ))}
            <button
              onClick={addTeam}
              className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide transition-colors font-sans text-brand-blue dark:text-[#38bdf8]"
            >
              <Plus className="h-3 w-3" />
              Add team
            </button>
          </div>

          {/* Rotation Offset */}
          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase block font-sans text-gray-500 dark:text-[#3a3a5a]">
              Rotation Offset
            </label>
            <p className="text-[9px] mb-1 font-mono text-gray-400 dark:text-[#1e1e35]">
              Shift starting position (0 = default).
            </p>
            <input
              type="number"
              value={offset}
              onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
              className="w-20 px-3 py-2 text-xs rounded-md outline-none font-mono bg-gray-50 border border-gray-200 text-gray-900 dark:bg-[#07070f] dark:border-[#171730] dark:text-zinc-300"
              min={0}
            />
          </div>

          {/* Task Limits */}
          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-bold tracking-widest uppercase font-sans text-gray-500 dark:text-[#3a3a5a]">
                Task Limits Per Day
              </label>
              <p className="text-[9px] font-mono text-gray-400 dark:text-[#1e1e35]">
                Set recommended max tasks per type. Empty = unlimited. Soft limit only.
              </p>
            </div>

            {/* Defaults row */}
            <div>
              <span className="text-[8px] font-bold tracking-widest uppercase font-sans text-gray-400 dark:text-[#3a3a5a] mb-1 block">
                Defaults (all days)
              </span>
              <div className="flex items-center gap-2">
                {TASK_TYPES.map((type) => {
                  const color = TASK_TYPE_COLORS[type];
                  return (
                    <div key={type} className="flex flex-col items-center gap-1">
                      <span
                        className="text-[8px] font-bold font-sans"
                        style={{ color }}
                      >
                        {type}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={limitDefaults[type] ?? ''}
                        onChange={(e) => updateDefault(type, e.target.value)}
                        placeholder="--"
                        className="w-12 px-1.5 py-1 text-[10px] text-center rounded outline-none font-mono bg-gray-50 border border-gray-200 text-gray-900 dark:bg-[#07070f] dark:border-[#171730] dark:text-zinc-300"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-day overrides */}
            <div>
              <span className="text-[8px] font-bold tracking-widest uppercase font-sans text-gray-400 dark:text-[#3a3a5a] mb-1 block">
                Per-Slot Overrides
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr>
                      <th className="text-left py-1 pr-2 font-bold font-sans text-gray-400 dark:text-[#3a3a5a] text-[8px] tracking-wider uppercase">Slot</th>
                      {TASK_TYPES.map((type) => (
                        <th
                          key={type}
                          className="py-1 px-1 font-bold font-sans text-[8px] text-center"
                          style={{ color: TASK_TYPE_COLORS[type] }}
                        >
                          {type}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOT_LABELS.map((slotLabel, dayIdx) => (
                      <tr key={dayIdx} className="border-t border-gray-100 dark:border-[#111124]">
                        <td className="py-1 pr-2 font-bold font-mono text-gray-500 dark:text-[#3a3a5a] text-[9px]">
                          {slotLabel}
                        </td>
                        {TASK_TYPES.map((type) => {
                          const defaultVal = limitDefaults[type] ?? '';
                          return (
                            <td key={type} className="py-1 px-1">
                              <input
                                type="number"
                                min={0}
                                value={limitOverrides[String(dayIdx)]?.[type] ?? ''}
                                onChange={(e) => updateOverride(dayIdx, type, e.target.value)}
                                placeholder={defaultVal || '--'}
                                className="w-12 px-1.5 py-0.5 text-[10px] text-center rounded outline-none font-mono bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-300 dark:bg-[#07070f] dark:border-[#171730] dark:text-zinc-300 dark:placeholder:text-[#252545]"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-[#111124]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg transition-colors font-sans text-gray-500 hover:text-gray-700 dark:text-[#3a3a5a] dark:hover:text-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateConfig.isPending || teamNames.every((n) => !n.trim())}
            className="px-4 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 font-sans bg-brand-dark-pink text-white dark:bg-[#ff9a6c] dark:text-[#07070e]"
          >
            {updateConfig.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
