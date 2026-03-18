'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  SkipForward,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { SchedulerTask } from '@/lib/hooks/useScheduler.query';
import { formatTimeInTz, formatDuration } from '@/lib/scheduler/time-helpers';

const STATUS_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'PENDING', label: 'Pending', color: '#3a3a5a' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: '#38bdf8' },
  { key: 'DONE', label: 'Done', color: '#4ade80' },
  { key: 'SKIPPED', label: 'Skipped', color: '#fbbf24' },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-2.5 w-2.5" />,
  IN_PROGRESS: <Play className="h-2.5 w-2.5" />,
  DONE: <CheckCircle2 className="h-2.5 w-2.5" />,
  SKIPPED: <SkipForward className="h-2.5 w-2.5" />,
};

const TASK_TYPES = ['', 'Chatting', 'PPV', 'Feed Post', 'Story', 'Reel', 'Custom'];

const LA_TZ = 'America/Los_Angeles';

interface SchedulerTaskCardProps {
  task: SchedulerTask;
  team: string;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
}

export function SchedulerTaskCard({ task, team, onUpdate }: SchedulerTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [localNotes, setLocalNotes] = useState(task.notes);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setShowTypeMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleStatusChange = useCallback((newStatus: string) => {
    const updates: Partial<SchedulerTask> = { status: newStatus as SchedulerTask['status'] };
    if (newStatus === 'IN_PROGRESS' && !task.startTime) updates.startTime = new Date().toISOString();
    if (newStatus === 'DONE' && task.startTime && !task.endTime) updates.endTime = new Date().toISOString();
    onUpdate(task.id, updates);
    setShowStatusMenu(false);
  }, [task, onUpdate]);

  const handleNameBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val !== task.taskName) onUpdate(task.id, { taskName: val });
    setIsEditing(false);
  }, [task, onUpdate]);

  const handleNotesBlur = useCallback(() => {
    if (localNotes !== task.notes) onUpdate(task.id, { notes: localNotes });
  }, [localNotes, task, onUpdate]);

  const statusOpt = STATUS_OPTIONS.find((s) => s.key === task.status) || STATUS_OPTIONS[0];

  return (
    <div className="flex flex-col gap-2">
      {/* Task name */}
      {isEditing ? (
        <input
          defaultValue={task.taskName}
          onBlur={handleNameBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full text-xs border-b px-1 py-0.5 outline-none font-mono bg-gray-50 text-gray-900 border-brand-blue dark:bg-gray-950 dark:text-gray-200 dark:border-[#38bdf8]"
          autoFocus
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="text-xs truncate cursor-text px-1 min-h-[18px] font-mono text-gray-700 dark:text-gray-300"
        >
          {task.taskName || (
            <span className="text-gray-400 dark:text-gray-700 italic">click to add task...</span>
          )}
        </div>
      )}

      {/* Status + Type row */}
      <div className="flex items-center gap-1.5 px-1 flex-wrap">
        {/* Status */}
        <div className="relative" ref={statusMenuRef}>
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-1 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full border transition-all font-sans"
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

        {/* Task type */}
        <div className="relative" ref={typeMenuRef}>
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full border transition-colors font-sans text-gray-500 border-gray-300 hover:border-gray-400 hover:text-gray-600 dark:text-gray-500 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:text-gray-400"
          >
            {task.taskType || 'TYPE'}
            <ChevronDown className="h-2 w-2" />
          </button>
          {showTypeMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 rounded-lg shadow-xl py-1 min-w-[90px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
              {TASK_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => { onUpdate(task.id, { taskType: type }); setShowTypeMenu(false); }}
                  className="w-full px-3 py-1.5 text-[10px] text-left font-sans text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  {type || 'None'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Time info (start/end) */}
      {task.startTime && (
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
      )}

      {/* Notes */}
      <button
        onClick={() => setShowNotes(!showNotes)}
        className="flex items-center gap-1 text-[9px] transition-colors px-1 text-gray-400 hover:text-gray-600 dark:text-gray-700 dark:hover:text-gray-500"
      >
        <MessageSquare className="h-2.5 w-2.5" />
        {task.notes ? 'notes' : 'add note'}
      </button>
      {showNotes && (
        <textarea
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={handleNotesBlur}
          className="w-full text-[10px] rounded p-1.5 resize-none outline-none font-mono bg-gray-50 border border-gray-200 text-gray-600 focus:border-gray-400 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-400 dark:focus:border-gray-700"
          rows={2}
          placeholder="Add notes..."
        />
      )}

      {/* Updated by */}
      {task.updatedBy && (
        <div className="text-[8px] px-1 truncate font-mono text-gray-400 dark:text-gray-700">
          updated by {task.updatedBy}
        </div>
      )}
    </div>
  );
}
