'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useUpdatePodConfig, PodTrackerConfig } from '@/lib/hooks/usePodTracker.query';
import { tabId } from '@/lib/hooks/usePodTrackerRealtime';

interface TrackerConfigModalProps {
  config: PodTrackerConfig | null;
  open: boolean;
  onClose: () => void;
}

export function TrackerConfigModal({ config, open, onClose }: TrackerConfigModalProps) {
  const [teamNames, setTeamNames] = useState<string[]>(['']);
  const [offset, setOffset] = useState(0);
  const updateConfig = useUpdatePodConfig();

  useEffect(() => {
    if (config) {
      setTeamNames(config.teamNames.length > 0 ? [...config.teamNames] : ['']);
      setOffset(config.rotationOffset);
    } else {
      setTeamNames(['']);
      setOffset(0);
    }
  }, [config, open]);

  if (!open) return null;

  const handleSave = async () => {
    const filtered = teamNames.map((n) => n.trim()).filter(Boolean);
    if (filtered.length === 0) return;
    await updateConfig.mutateAsync({ teamNames: filtered, rotationOffset: offset, tabId });
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/88">
      <div
        className="rounded-xl w-full max-w-md mx-4 flex flex-col max-h-[92vh] overflow-y-auto bg-white border border-gray-200 dark:bg-[#0b0b1a] dark:border-[#111124]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#111124]">
          <h2 className="text-sm font-bold font-sans text-gray-900 dark:text-zinc-300">
            {config ? 'Edit Teams' : 'Setup POD Tracker'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-4 w-4 text-gray-400 dark:text-[#555]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {!config && (
            <p className="text-xs font-mono text-gray-500 dark:text-[#3a3a5a]">
              Enter your team names. Teams rotate daily across 7 slots (Sun=1A → Sat=1G).
            </p>
          )}

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
