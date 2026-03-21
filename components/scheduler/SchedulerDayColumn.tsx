'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { SchedulerTask, TaskLimits } from '@/lib/hooks/useScheduler.query';
import { SchedulerTaskCard, TASK_TYPES, TASK_TYPE_COLORS } from './SchedulerTaskCard';
import { getSlotForDay, DAY_NAMES, DAY_NAMES_FULL } from '@/lib/scheduler/rotation';
import { getCurrentTimeDisplay, getCountdownToReset } from '@/lib/scheduler/time-helpers';
import { getTaskLimit } from '@/lib/scheduler/task-limits';

// ─── Portal-based Add Task Menu ───────────────────────────────────────────────
function AddTaskMenu({
  dayIndex,
  onCreateTask,
  onClose,
  anchorRef,
  align = 'below',
}: {
  dayIndex: number;
  onCreateTask: (dayOfWeek: number, taskType: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  align?: 'below' | 'above';
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    if (align === 'above') {
      setPos({ top: rect.top - 4, left: rect.left });
    } else {
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [anchorRef, align]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] rounded-lg shadow-xl py-1 min-w-[120px] bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-800"
      style={{
        top: align === 'above' ? undefined : pos.top,
        bottom: align === 'above' ? `${window.innerHeight - pos.top}px` : undefined,
        left: pos.left,
      }}
    >
      {TASK_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => {
            onCreateTask(dayIndex, type);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-800"
          style={{ color: TASK_TYPE_COLORS[type] }}
        >
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: TASK_TYPE_COLORS[type] }} />
          Add {type}
        </button>
      ))}
    </div>,
    document.body,
  );
}

const TEAM_COLORS: Record<string, string> = {
  'Running Queue': '#4ade80',
  'Upcoming Day': '#38bdf8',
  'Flyer Team': '#c084fc',
  'Folder Team': '#fb923c',
  'Paywall Team': '#f472b6',
  'Caption Replacing': '#22d3ee',
  'Not Running': '#3a3a5a',
};

/** Group tasks by taskType, ordered by TASK_TYPES constant */
function groupByType(tasks: SchedulerTask[]) {
  const groups: { type: string; tasks: SchedulerTask[] }[] = [];
  for (const t of TASK_TYPES) {
    const matching = tasks.filter((task) => task.taskType === t);
    if (matching.length > 0) groups.push({ type: t, tasks: matching });
  }
  const other = tasks.filter(
    (task) => !TASK_TYPES.includes(task.taskType as (typeof TASK_TYPES)[number]),
  );
  if (other.length > 0) groups.push({ type: 'Other', tasks: other });
  return groups;
}

// ─── Inline-editable Task Limit Badge ────────────────────────────────────────
function TaskLimitBadge({
  type,
  doneCount,
  totalCount,
  max,
  onChangeMax,
}: {
  type: string;
  doneCount: number;
  totalCount: number;
  max: number;
  onChangeMax?: (type: string, newMax: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const color = TASK_TYPE_COLORS[type] || '#3a3a5a';
  const hasLimit = isFinite(max);
  const overLimit = hasLimit && totalCount > max;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (!onChangeMax) return;
    const trimmed = inputVal.trim();
    if (trimmed === '' || trimmed === '0') {
      onChangeMax(type, null); // remove limit
    } else {
      const n = parseInt(trimmed);
      if (!isNaN(n) && n > 0) onChangeMax(type, n);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-10 px-0.5 py-0.5 text-[8px] text-center rounded outline-none font-mono bg-gray-50 border border-gray-300 text-gray-900 dark:bg-[#07070f] dark:border-[#333] dark:text-zinc-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ borderColor: color + '60' }}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        if (!onChangeMax) return;
        e.stopPropagation();
        setInputVal(hasLimit ? String(max) : '');
        setEditing(true);
      }}
      className="text-[8px] font-bold px-1 py-0.5 rounded font-sans transition-all"
      style={{
        background: overLimit ? '#ef444425' : color + '18',
        color: overLimit ? '#ef4444' : color,
        border: `1px solid ${overLimit ? '#ef444450' : color + '30'}`,
        cursor: onChangeMax ? 'pointer' : 'default',
      }}
      title={onChangeMax ? `${totalCount}${hasLimit ? `/${max}` : ''} ${type} — click to edit max` : undefined}
    >
      {totalCount}{hasLimit ? `/${max}` : ''}
    </span>
  );
}

interface SchedulerDayColumnProps {
  dayIndex: number;
  date: Date;
  tasks: SchedulerTask[];
  team: string;
  onUpdate: (id: string, data: Partial<SchedulerTask>) => void;
  onDelete: (id: string) => void;
  onCreateTask: (dayOfWeek: number, taskType: string) => void;
  isToday: boolean;
  timeZone: string;
  weekStart: string;
  expanded: boolean;
  /** True when another column is expanded (this one should become a sidebar strip) */
  collapsed: boolean;
  /** Which side the hover popup should appear: 'left' or 'right' */
  popupDirection?: 'left' | 'right';
  onToggleExpand: () => void;
  taskLimits?: TaskLimits | null;
  onUpdateTaskLimits?: (dayIndex: number, type: string, newMax: number | null) => void;
}

export function SchedulerDayColumn({
  dayIndex,
  date,
  tasks,
  team,
  onUpdate,
  onDelete,
  onCreateTask,
  isToday,
  timeZone,
  expanded,
  collapsed,
  popupDirection = 'right',
  onToggleExpand,
  taskLimits,
  onUpdateTaskLimits,
}: SchedulerDayColumnProps) {
  const slotLabel = getSlotForDay(dayIndex);
  const teamColor = TEAM_COLORS[team] || '#3a3a5a';
  const isRunningQueue = team === 'Running Queue';
  const isNotRunning = team === 'Not Running';

  const [liveTime, setLiveTime] = useState('');
  const [countdown, setCountdown] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isNotRunning) return;
    const update = () => {
      if (isRunningQueue) {
        setLiveTime(getCurrentTimeDisplay(timeZone));
      } else {
        setCountdown(getCountdownToReset(new Date()));
      }
    };
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [isRunningQueue, isNotRunning, timeZone]);

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const totalTasks = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const progress = totalTasks > 0 ? doneCount / totalTasks : 0;

  const handleBadgeChangeMax = useCallback(
    (type: string, newMax: number | null) => {
      onUpdateTaskLimits?.(dayIndex, type, newMax);
    },
    [dayIndex, onUpdateTaskLimits],
  );

  // Type counts for collapsed/normal view — show types with tasks OR with limits
  const typeCounts = useMemo(() => {
    const counts: { type: string; count: number; doneCount: number; max: number }[] = [];
    for (const t of TASK_TYPES) {
      const matching = tasks.filter((task) => task.taskType === t);
      const max = getTaskLimit(taskLimits, dayIndex, t);
      if (matching.length > 0 || isFinite(max)) {
        counts.push({
          type: t,
          count: matching.length,
          doneCount: matching.filter((task) => task.status === 'DONE').length,
          max,
        });
      }
    }
    return counts;
  }, [tasks, taskLimits, dayIndex]);

  const groups = useMemo(() => groupByType(tasks), [tasks]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLAPSED STRIP — overlapping horizontal cards, hover to pop up
  // ═══════════════════════════════════════════════════════════════════════════
  if (collapsed) {
    // Popup goes right for strips left of expanded, left for strips right of expanded
    const popLeft = popupDirection === 'left';

    return (
      <div
        className="relative flex-shrink-0 hover:!z-50 transition-[z-index] duration-0"
        style={{
          width: 48,
          marginRight: -22,
          zIndex: 2,
        }}
      >
        {/* The strip card */}
        <div
          onClick={onToggleExpand}
          className="group relative cursor-pointer rounded-lg border overflow-visible h-full bg-white dark:bg-[#0c0c1a] border-gray-200 dark:border-[#111124] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 hover:border-gray-300 dark:hover:border-[#333355]"
          style={{
            ...(isToday && { borderColor: teamColor + '50' }),
          }}
        >
          {/* Top color bar */}
          <div
            className="w-full h-1.5 rounded-t-lg flex-shrink-0"
            style={{ background: teamColor }}
          />

          {/* Vertical content */}
          <div className="flex flex-col items-center gap-1.5 py-2.5 px-1">
            {/* Day name */}
            <span
              className="text-[9px] font-bold tracking-widest font-sans"
              style={{ color: teamColor, writingMode: 'vertical-lr', textOrientation: 'mixed' }}
            >
              {DAY_NAMES[dayIndex]}
            </span>

            {/* Slot label */}
            <span
              className="text-[7px] font-bold font-mono"
              style={{ color: teamColor, writingMode: 'vertical-lr', textOrientation: 'mixed' }}
            >
              {slotLabel}
            </span>

            {/* Team name */}
            <span
              className="text-[7px] font-bold tracking-wide font-sans max-h-[60px] overflow-hidden"
              style={{ color: teamColor, writingMode: 'vertical-lr', textOrientation: 'mixed' }}
            >
              {team}
            </span>

            {/* Time */}
            {isRunningQueue && liveTime && (
              <span
                className="text-[7px] font-bold font-mono animate-pulse"
                style={{ color: teamColor, writingMode: 'vertical-lr', textOrientation: 'mixed' }}
              >
                {liveTime}
              </span>
            )}
            {!isRunningQueue && !isNotRunning && countdown && (
              <span
                className="text-[7px] font-mono text-gray-500 dark:text-gray-500"
                style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
              >
                {countdown}
              </span>
            )}

            {/* Mini progress ring */}
            {totalTasks > 0 && (
              <div className="relative h-5 w-5 flex items-center justify-center flex-shrink-0 mt-auto">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke={teamColor + '30'} strokeWidth="3" />
                  <circle
                    cx="12" cy="12" r="10" fill="none"
                    stroke={progress === 1 ? '#4ade80' : teamColor}
                    strokeWidth="3"
                    strokeDasharray={`${progress * 62.83} 62.83`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[6px] font-bold font-mono text-gray-600 dark:text-gray-400">
                  {doneCount}
                </span>
              </div>
            )}

            {/* Type dots */}
            <div className="flex flex-col gap-0.5 items-center">
              {typeCounts.map(({ type }) => (
                <div
                  key={type}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: TASK_TYPE_COLORS[type] || '#3a3a5a' }}
                />
              ))}
            </div>
          </div>

          {/* Hover popup — appears to left or right depending on position */}
          <div
            className={
              'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 ' +
              'absolute top-0 flex flex-col gap-1.5 ' +
              'w-[190px] p-3 rounded-lg border ' +
              'shadow-2xl shadow-black/40 ' +
              'bg-white dark:bg-[#0e0e1e] border-gray-200 dark:border-[#333355] ' +
              'transition-all duration-150 ease-out ' +
              (popLeft
                ? 'right-full mr-2 group-hover:translate-x-0 translate-x-2'
                : 'left-full ml-2 group-hover:translate-x-0 -translate-x-2')
            }
            style={{ zIndex: 100 }}
          >
            {/* Day + date */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest font-sans" style={{ color: teamColor }}>
                {DAY_NAMES[dayIndex]}
              </span>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded font-mono"
                style={{ background: teamColor + '20', color: teamColor, border: `1px solid ${teamColor}40` }}
              >
                {slotLabel}
              </span>
              <span className="text-[8px] font-mono text-gray-500 dark:text-gray-400">{dateStr}</span>
            </div>

            {/* Team */}
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: teamColor, boxShadow: isRunningQueue ? `0 0 4px ${teamColor}` : 'none' }}
              />
              <span className="text-[9px] font-bold tracking-wide font-sans" style={{ color: teamColor }}>
                {team}
              </span>
            </div>

            {/* Time */}
            {isRunningQueue && liveTime && (
              <div className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: teamColor }} />
                <span className="text-[9px] font-bold font-mono" style={{ color: teamColor }}>{liveTime}</span>
              </div>
            )}
            {!isRunningQueue && !isNotRunning && countdown && (
              <div className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5 text-gray-500" />
                <span className="text-[9px] font-mono text-gray-500">{countdown}</span>
              </div>
            )}

            {/* Type badges + progress */}
            {totalTasks > 0 && (
              <>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {typeCounts.map(({ type, count, max }) => {
                    const color = TASK_TYPE_COLORS[type] || '#3a3a5a';
                    const hasLimit = isFinite(max);
                    const overLimit = hasLimit && count > max;
                    return (
                      <span
                        key={type}
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded font-sans"
                        style={{
                          background: overLimit ? '#ef444425' : color + '20',
                          color: overLimit ? '#ef4444' : color,
                          border: `1px solid ${overLimit ? '#ef444450' : color + '40'}`,
                        }}
                      >
                        {count}{hasLimit ? `/${max}` : ''} {type}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-[#1a1a2e] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${progress * 100}%`, background: progress === 1 ? '#4ade80' : teamColor }}
                    />
                  </div>
                  <span className="text-[8px] font-bold font-mono text-gray-600 dark:text-gray-400">
                    {doneCount}/{totalTasks}
                  </span>
                </div>
              </>
            )}

            <span className="text-[8px] font-mono text-gray-500 dark:text-gray-500 mt-0.5">
              click to expand
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED — full detail view with multi-column grouped tasks
  // ═══════════════════════════════════════════════════════════════════════════
  if (expanded) {
    return (
      <div
        className={`flex flex-col flex-1 min-w-0 rounded-lg overflow-hidden border transition-all bg-white dark:bg-[#0c0c1a] relative z-10 ${
          isToday ? '' : 'border-gray-200 dark:border-[#111124]'
        }`}
        style={{
          ...(isToday && {
            borderColor: teamColor + '50',
            boxShadow: `0 0 16px ${teamColor}20`,
          }),
        }}
      >
        {/* Expanded header */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{
            borderColor: teamColor + '30',
            background: teamColor + '08',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{
                background: teamColor,
                boxShadow: isRunningQueue ? `0 0 8px ${teamColor}` : 'none',
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-sans" style={{ color: teamColor }}>
                  {DAY_NAMES_FULL[dayIndex]}
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                  style={{
                    background: teamColor + '18',
                    color: teamColor,
                    border: `1px solid ${teamColor}30`,
                  }}
                >
                  {slotLabel}
                </span>
                <span className="text-xs font-mono text-gray-400 dark:text-[#3a3a5a]">
                  {dateStr}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold tracking-wide font-sans" style={{ color: teamColor }}>
                  {team}
                </span>
                <span className="text-[9px] font-mono text-gray-500 dark:text-[#3a3a5a]">
                  {doneCount}/{totalTasks} done
                </span>
                {/* Time */}
                {isRunningQueue && liveTime && (
                  <span className="text-[10px] font-bold font-mono animate-pulse" style={{ color: teamColor }}>
                    {liveTime}
                  </span>
                )}
                {!isRunningQueue && !isNotRunning && countdown && (
                  <span className="text-[10px] font-mono text-gray-400 dark:text-[#3a3a5a]">
                    {countdown}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Add task button */}
            <button
              ref={addBtnRef}
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide font-sans border transition-all text-brand-blue border-brand-blue/25 bg-brand-blue/5 dark:text-[#38bdf8] dark:border-[#38bdf840] dark:bg-[#38bdf812]"
            >
              <Plus className="h-3 w-3" />
              ADD
            </button>
            {showAddMenu && (
              <AddTaskMenu
                dayIndex={dayIndex}
                onCreateTask={onCreateTask}
                onClose={() => setShowAddMenu(false)}
                anchorRef={addBtnRef}
              />
            )}

            {/* Collapse button */}
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              title="Collapse"
            >
              <Minimize2 className="h-4 w-4 text-gray-400 dark:text-[#3a3a5a]" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="px-4 py-1.5 bg-gray-50/50 dark:bg-[#090912]/50">
            <div className="flex items-center gap-3">
              {/* Type badges */}
              <div className="flex gap-1.5">
                {typeCounts.map(({ type, count, max }) => (
                  <TaskLimitBadge
                    key={type}
                    type={type}
                    doneCount={count}
                    totalCount={count}
                    max={max}
                    onChangeMax={onUpdateTaskLimits ? handleBadgeChangeMax : undefined}
                  />
                ))}
              </div>
              {/* Bar */}
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-[#111124] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress * 100}%`,
                    background: progress === 1 ? '#4ade80' : teamColor,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Task groups — scrollable, multi-column */}
        <div className="flex-1 overflow-y-auto p-4">
          {groups.length === 0 ? (
            <div className="text-center py-10 text-xs font-mono text-gray-400 dark:text-[#3a3a5a]">
              No tasks yet — click ADD to create one.
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => {
                const color = TASK_TYPE_COLORS[group.type] || '#3a3a5a';
                return (
                  <div key={group.type}>
                    {/* Group header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span
                        className="text-xs font-bold tracking-widest font-sans"
                        style={{ color }}
                      >
                        {group.type}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 dark:text-[#3a3a5a]">
                        {(() => {
                          const done = group.tasks.filter((t) => t.status === 'DONE').length;
                          const total = group.tasks.length;
                          const max = getTaskLimit(taskLimits, dayIndex, group.type);
                          const hasLimit = isFinite(max);
                          return hasLimit ? `${done}/${total} / ${max}` : `${done}/${total}`;
                        })()}
                      </span>
                      <div className="flex-1 h-px" style={{ background: color + '25' }} />
                    </div>

                    {/* Cards in 2-column grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {group.tasks.map((task) => (
                        <SchedulerTaskCard
                          key={task.id}
                          task={task}
                          team={team}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NORMAL — default compact summary (no column expanded)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className={`flex flex-col rounded-lg overflow-hidden border transition-all ${
        isToday ? '' : 'border-gray-200 dark:border-[#111124]'
      } bg-white dark:bg-[#0c0c1a]`}
      style={{
        ...(isToday && {
          borderColor: teamColor + '50',
          boxShadow: `0 0 12px ${teamColor}15`,
        }),
        opacity: isNotRunning ? 0.55 : 1,
      }}
    >
      {/* Header */}
      <div
        className={`px-3 py-2 border-b flex flex-col gap-1.5 ${
          isToday ? '' : 'bg-gray-50 border-gray-200 dark:bg-[#090912] dark:border-[#111124]'
        }`}
        style={isToday ? {
          borderColor: teamColor + '30',
          background: teamColor + '08',
        } : undefined}
      >
        {/* Row 1 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold tracking-widest font-sans ${
                isToday ? '' : 'text-gray-400 dark:text-[#3a3a5a]'
              }`}
              style={isToday ? { color: teamColor } : undefined}
            >
              {DAY_NAMES[dayIndex]}
            </span>
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono cursor-pointer hover:brightness-125 transition-all"
              style={{
                background: teamColor + '18',
                color: teamColor,
                border: `1px solid ${teamColor}30`,
              }}
              title="Expand day"
            >
              {slotLabel}
              <Maximize2 className="h-2.5 w-2.5" />
            </button>
          </div>
          <span className="text-[9px] font-mono text-gray-300 dark:text-[#252545]">
            {dateStr}
          </span>
        </div>

        {/* Row 2: Team */}
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{
              background: teamColor,
              boxShadow: isRunningQueue ? `0 0 6px ${teamColor}` : 'none',
            }}
          />
          <span className="text-[10px] font-bold tracking-wide font-sans" style={{ color: teamColor }}>
            {team}
          </span>
        </div>

        {/* Row 3: Time */}
        <div className="flex items-center gap-1.5 min-h-[16px]">
          {isRunningQueue && liveTime && (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: teamColor }} />
              <span className="text-[10px] font-bold tracking-wide font-mono" style={{ color: teamColor }}>
                {liveTime}
              </span>
            </>
          )}
          {!isRunningQueue && !isNotRunning && countdown && (
            <>
              <Clock className="h-3 w-3 text-gray-400 dark:text-[#3a3a5a]" />
              <span className="text-[10px] font-mono text-gray-400 dark:text-[#3a3a5a]">{countdown}</span>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-2.5 flex-1 flex flex-col gap-2.5">
        {totalTasks === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 gap-2">
            <span className="text-[10px] italic font-mono text-gray-300 dark:text-[#1e1e35]">
              No tasks
            </span>
            <div>
              <button
                ref={addBtnRef}
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1 text-[9px] font-bold tracking-wide font-sans transition-colors text-brand-blue dark:text-[#38bdf8]"
              >
                <Plus className="h-3 w-3" />
                ADD
              </button>
              {showAddMenu && (
                <AddTaskMenu
                  dayIndex={dayIndex}
                  onCreateTask={onCreateTask}
                  onClose={() => setShowAddMenu(false)}
                  anchorRef={addBtnRef}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Task count badges + progress */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {typeCounts.map(({ type, count, max }) => (
                  <TaskLimitBadge
                    key={type}
                    type={type}
                    doneCount={count}
                    totalCount={count}
                    max={max}
                    onChangeMax={onUpdateTaskLimits ? handleBadgeChangeMax : undefined}
                  />
                ))}
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-[#111124] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress * 100}%`,
                    background: progress === 1 ? '#4ade80' : teamColor,
                  }}
                />
              </div>
              <span className="text-[9px] font-bold font-mono text-gray-500 dark:text-[#3a3a5a] whitespace-nowrap">
                {doneCount}/{totalTasks}
              </span>
            </div>

            {/* Grouped task cards — scrollable */}
            <div className="flex-1 overflow-y-auto -mx-0.5 px-0.5 space-y-2">
              {groups.map((group) => {
                const color = TASK_TYPE_COLORS[group.type] || '#3a3a5a';
                return (
                  <div key={group.type}>
                    {/* Group label */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-[9px] font-bold tracking-widest font-sans" style={{ color }}>
                        {group.type}
                      </span>
                      <span className="text-[8px] font-mono text-gray-400 dark:text-[#3a3a5a]">
                        {(() => {
                          const max = getTaskLimit(taskLimits, dayIndex, group.type);
                          return isFinite(max)
                            ? `(${group.tasks.length}/${max})`
                            : `(${group.tasks.length})`;
                        })()}
                      </span>
                      <div className="flex-1 h-px" style={{ background: color + '20' }} />
                    </div>
                    <div className="space-y-1">
                      {group.tasks.map((task) => (
                        <SchedulerTaskCard
                          key={task.id}
                          task={task}
                          team={team}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add task */}
            <div className="flex items-center pt-1">
              <button
                ref={addBtnRef}
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1 text-[9px] font-bold tracking-wide font-sans px-2 py-1 rounded-full border transition-colors text-gray-400 border-gray-200 hover:border-gray-300 dark:text-[#3a3a5a] dark:border-[#111124] dark:hover:border-[#222244]"
              >
                <Plus className="h-3 w-3" />
                ADD
              </button>
              {showAddMenu && (
                <AddTaskMenu
                  dayIndex={dayIndex}
                  onCreateTask={onCreateTask}
                  onClose={() => setShowAddMenu(false)}
                  anchorRef={addBtnRef}
                  align="above"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
