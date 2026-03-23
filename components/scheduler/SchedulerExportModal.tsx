'use client';

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { useExportScheduler, type SchedulerTask } from '@/lib/hooks/useScheduler.query';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ExportMode = 'week' | 'day';

interface SchedulerExportModalProps {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  platform: string;
  profileId: string | null;
  profileName: string;
  weekDays: Date[];
  tasksByDay: Map<number, SchedulerTask[]>;
}

export function SchedulerExportModal({
  open,
  onClose,
  weekStart,
  platform,
  profileId,
  profileName,
  weekDays,
  tasksByDay,
}: SchedulerExportModalProps) {
  const [mode, setMode] = useState<ExportMode>('week');
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const exportScheduler = useExportScheduler();

  const totalTasks = Array.from(tasksByDay.values()).reduce((sum, tasks) => sum + tasks.length, 0);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const weekRange = weekDays.length === 7
    ? `${formatDate(weekDays[0])} – ${formatDate(weekDays[6])}`
    : '';

  const handleExport = useCallback(() => {
    exportScheduler.mutate(
      {
        weekStart,
        platform,
        profileId,
        profileName,
        ...(mode === 'day' ? { dayOfWeek: selectedDay } : {}),
      },
      { onSuccess: () => onClose() },
    );
  }, [exportScheduler, weekStart, platform, profileId, profileName, mode, selectedDay, onClose]);

  const handleClose = useCallback(() => {
    if (exportScheduler.isPending) return;
    setMode('week');
    setSelectedDay(0);
    onClose();
  }, [onClose, exportScheduler.isPending]);

  if (!open) return null;

  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 flex flex-col bg-white dark:bg-[#0c0c1a] border border-gray-200 dark:border-[#1a1a2e] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-[#1a1a2e]">
          <div className="flex items-center gap-2.5">
            <Upload className="h-4 w-4 text-brand-light-pink" />
            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Export Schedule
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Option: Entire Week */}
          <button
            onClick={() => setMode('week')}
            className={`w-full flex items-start gap-3 text-left px-3.5 py-3 rounded-lg border-2 transition-all ${
              mode === 'week'
                ? 'bg-brand-light-pink/10 border-brand-light-pink/40'
                : 'bg-gray-50/50 dark:bg-[#0a0a14]/50 border-gray-100 dark:border-[#151528] hover:border-gray-300 dark:hover:border-[#2a2a4e]'
            }`}
          >
            {/* Radio */}
            <div className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              mode === 'week' ? 'border-brand-light-pink' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {mode === 'week' && <div className="w-1.5 h-1.5 rounded-full bg-brand-light-pink" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`h-3.5 w-3.5 ${mode === 'week' ? 'text-brand-light-pink' : 'text-gray-400'}`} />
                <span className={`text-[11px] font-bold ${mode === 'week' ? 'text-brand-light-pink' : 'text-gray-700 dark:text-gray-300'}`}>
                  Entire Week
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#151528] text-gray-500 dark:text-gray-500">
                  .xlsx
                </span>
              </div>
              <p className={`text-[10px] mt-1 ${mode === 'week' ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                Export all 7 days as a spreadsheet with sheet tabs (Schedule #1A–#1G).
                <span className="ml-1 font-semibold">{totalTasks} task{totalTasks !== 1 ? 's' : ''} total.</span>
              </p>
            </div>
          </button>

          {/* Option: Single Day */}
          <button
            onClick={() => setMode('day')}
            className={`w-full flex items-start gap-3 text-left px-3.5 py-3 rounded-lg border-2 transition-all ${
              mode === 'day'
                ? 'bg-brand-light-pink/10 border-brand-light-pink/40'
                : 'bg-gray-50/50 dark:bg-[#0a0a14]/50 border-gray-100 dark:border-[#151528] hover:border-gray-300 dark:hover:border-[#2a2a4e]'
            }`}
          >
            {/* Radio */}
            <div className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              mode === 'day' ? 'border-brand-light-pink' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {mode === 'day' && <div className="w-1.5 h-1.5 rounded-full bg-brand-light-pink" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <FileText className={`h-3.5 w-3.5 ${mode === 'day' ? 'text-brand-light-pink' : 'text-gray-400'}`} />
                <span className={`text-[11px] font-bold ${mode === 'day' ? 'text-brand-light-pink' : 'text-gray-700 dark:text-gray-300'}`}>
                  Single Day
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#151528] text-gray-500 dark:text-gray-500">
                  .csv
                </span>
              </div>
              <p className={`text-[10px] mt-1 ${mode === 'day' ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                Export a single day as a CSV file.
              </p>
            </div>
          </button>

          {/* Day picker (only when single day is selected) */}
          {mode === 'day' && (
            <div className="pl-7 space-y-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                  Select a day
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((date, i) => {
                  const dayTaskCount = tasksByDay.get(i)?.length ?? 0;
                  const isSelected = selectedDay === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDay(i)}
                      className={`flex flex-col items-center py-2 px-1 rounded-lg border transition-all text-center ${
                        isSelected
                          ? 'bg-brand-light-pink/15 border-brand-light-pink/40 text-brand-light-pink'
                          : 'bg-gray-50 dark:bg-[#0a0a14] border-gray-100 dark:border-[#151528] hover:border-gray-300 dark:hover:border-[#2a2a4e] text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-brand-light-pink' : ''}`}>
                        {DAY_NAMES[i]}
                      </span>
                      <span className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-brand-light-pink/70' : 'text-gray-400 dark:text-gray-600'}`}>
                        {formatDate(date)}
                      </span>
                      <span className={`text-[9px] font-mono mt-1 px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-brand-light-pink/20 text-brand-light-pink'
                          : dayTaskCount > 0
                            ? 'bg-gray-100 dark:bg-[#151528] text-gray-500'
                            : 'text-gray-300 dark:text-gray-700'
                      }`}>
                        {dayTaskCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary line */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#0a0a14] border border-gray-100 dark:border-[#151528]">
            <span className="text-[10px] text-gray-400 dark:text-gray-600">
              <span className="font-semibold text-gray-600 dark:text-gray-300">{profileName}</span>
              {' · '}
              <span className="font-semibold" style={{ color: platform === 'free' ? '#4ade80' : platform === 'paid' ? '#f472b6' : platform === 'oftv' ? '#38bdf8' : '#c084fc' }}>
                {platformLabel}
              </span>
              {' · '}
              {weekRange}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-[#1a1a2e] flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={exportScheduler.isPending}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exportScheduler.isPending}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-light-pink text-white hover:bg-brand-mid-pink disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {exportScheduler.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Export {mode === 'week' ? 'Week (.xlsx)' : `${DAY_NAMES[selectedDay]} (.csv)`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
