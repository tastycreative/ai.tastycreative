'use client';

import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, FileSpreadsheet, FileText, Calendar,
  ExternalLink, CheckCircle2, AlertCircle, LogOut, RefreshCw,
} from 'lucide-react';
import { useExportScheduler, type SchedulerTask } from '@/lib/hooks/useScheduler.query';
import { useGoogleDriveAccount } from '@/lib/hooks/useGoogleDriveAccount';

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

interface SheetProgress {
  progress: number;
  message: string;
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

  // Google Sheets state
  const google = useGoogleDriveAccount();
  const [sheetProgress, setSheetProgress] = useState<SheetProgress | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const exportScheduler = useExportScheduler();

  const totalTasks = Array.from(tasksByDay.values()).reduce((sum, tasks) => sum + tasks.length, 0);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const weekRange = weekDays.length === 7
    ? `${formatDate(weekDays[0])} – ${formatDate(weekDays[6])}`
    : '';

  // Download as file (legacy .xlsx/.csv)
  const handleDownload = useCallback(() => {
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

  // Convert to Google Sheet via SSE
  const handleConvert = useCallback(async () => {
    // Ensure signed in — signIn() clears old cookies and gets fresh tokens with latest scopes
    if (!google.isSignedIn) {
      try {
        await google.signIn();
      } catch {
        return;
      }
    }

    setIsConverting(true);
    setSheetProgress({ progress: 0, message: 'Starting...' });
    setSheetUrl(null);
    setSheetError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const requestBody = JSON.stringify({
      weekStart,
      platform,
      profileId,
      profileName,
      ...(mode === 'day' ? { dayOfWeek: selectedDay } : {}),
    });

    try {
      let res = await fetch('/api/scheduler/export-to-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      });

      // Auto-reconnect if token expired or missing (old cookie path)
      if (res.status === 401) {
        setSheetError(null);
        setSheetProgress({ progress: 0, message: 'Reconnecting Google account...' });
        try {
          await google.signIn();
        } catch {
          throw new Error('Google sign-in failed. Please try again.');
        }
        res = await fetch('/api/scheduler/export-to-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: controller.signal,
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start conversion');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'progress') {
                setSheetProgress({ progress: data.progress, message: data.message });
              } else if (eventType === 'complete') {
                setSheetProgress({ progress: 100, message: 'Complete!' });
                setSheetUrl(data.url);
                setSheetError(null);
              } else if (eventType === 'error') {
                setSheetError(data.message);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSheetError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
      abortRef.current = null;
    }
  }, [google, weekStart, platform, profileId, profileName, mode, selectedDay]);

  const handleClose = useCallback(() => {
    if (exportScheduler.isPending || isConverting) return;
    abortRef.current?.abort();
    setMode('week');
    setSelectedDay(0);
    setSheetProgress(null);
    setSheetUrl(null);
    setSheetError(null);
    onClose();
  }, [onClose, exportScheduler.isPending, isConverting]);

  if (!open) return null;

  const isBusy = exportScheduler.isPending || isConverting;
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
            <FileSpreadsheet className="h-4 w-4 text-brand-light-pink" />
            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              Convert Schedule
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
          {/* Scope selector: Week vs Day */}
          <div className="flex gap-2">
            <button
              onClick={() => { if (!isBusy) setMode('week'); }}
              disabled={isBusy}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-[11px] font-bold ${
                mode === 'week'
                  ? 'bg-brand-light-pink/10 border-brand-light-pink/40 text-brand-light-pink'
                  : 'bg-gray-50/50 dark:bg-[#0a0a14]/50 border-gray-100 dark:border-[#151528] text-gray-500 hover:border-gray-300 dark:hover:border-[#2a2a4e]'
              } disabled:opacity-50`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Entire Week
            </button>
            <button
              onClick={() => { if (!isBusy) setMode('day'); }}
              disabled={isBusy}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-[11px] font-bold ${
                mode === 'day'
                  ? 'bg-brand-light-pink/10 border-brand-light-pink/40 text-brand-light-pink'
                  : 'bg-gray-50/50 dark:bg-[#0a0a14]/50 border-gray-100 dark:border-[#151528] text-gray-500 hover:border-gray-300 dark:hover:border-[#2a2a4e]'
              } disabled:opacity-50`}
            >
              <FileText className="h-3.5 w-3.5" />
              Single Day
            </button>
          </div>

          {/* Day picker (only when single day is selected) */}
          {mode === 'day' && !sheetUrl && (
            <div className="space-y-2">
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
                      onClick={() => { if (!isBusy) setSelectedDay(i); }}
                      disabled={isBusy}
                      className={`flex flex-col items-center py-2 px-1 rounded-lg border transition-all text-center ${
                        isSelected
                          ? 'bg-brand-light-pink/15 border-brand-light-pink/40 text-brand-light-pink'
                          : 'bg-gray-50 dark:bg-[#0a0a14] border-gray-100 dark:border-[#151528] hover:border-gray-300 dark:hover:border-[#2a2a4e] text-gray-600 dark:text-gray-400'
                      } disabled:opacity-50`}
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
              {' · '}
              <span className="font-semibold">{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
            </span>
          </div>

          {/* Google Account Section */}
          <div className="rounded-lg border border-gray-200 dark:border-[#1a1a2e] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-gray-50/50 dark:bg-[#0a0a14]/50 border-b border-gray-100 dark:border-[#151528]">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Google Account
              </span>
            </div>
            <div className="px-3.5 py-3">
              {google.isLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : google.isSignedIn && google.profile ? (
                <div className="flex items-center gap-3">
                  {google.profile.picture && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={google.profile.picture}
                      alt=""
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {google.profile.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {google.profile.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => google.switchAccount()}
                      disabled={isBusy}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                      title="Switch account"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => google.signOut()}
                      disabled={isBusy}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                      title="Sign out"
                    >
                      <LogOut className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => google.signIn()}
                  disabled={isBusy}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2a2a4e] bg-white dark:bg-[#0a0a14] hover:bg-gray-50 dark:hover:bg-[#151528] text-[11px] font-semibold text-gray-700 dark:text-gray-300 transition-all disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {sheetProgress && !sheetUrl && !sheetError && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                  {sheetProgress.message}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  {sheetProgress.progress}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-[#151528] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${sheetProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success: Sheet URL */}
          {sheetUrl && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mb-2">
                    Google Sheet created successfully!
                  </p>
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Google Sheet
                  </a>
                  <p className="mt-2 text-[9px] text-emerald-600/60 dark:text-emerald-400/50 break-all font-mono">
                    {sheetUrl}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {sheetError && !sheetUrl && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-600 dark:text-red-400">{sheetError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-[#1a1a2e] flex items-center justify-between gap-2">
          {/* Left: download as file */}
          <button
            onClick={handleDownload}
            disabled={isBusy}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
          >
            {exportScheduler.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Downloading...
              </span>
            ) : (
              <>Download {mode === 'week' ? '.xlsx' : '.csv'}</>
            )}
          </button>

          {/* Right: main action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={isBusy}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
            >
              {sheetUrl ? 'Done' : 'Cancel'}
            </button>
            {!sheetUrl && (
              <button
                onClick={handleConvert}
                disabled={isBusy}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-light-pink text-white hover:bg-brand-mid-pink disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Convert to Google Sheet
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
