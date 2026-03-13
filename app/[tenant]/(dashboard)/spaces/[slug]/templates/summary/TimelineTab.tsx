'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  AlertTriangle,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import type { BoardTask } from '../../../board';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface RoadmapTask extends BoardTask {
  barStart: Date;
  barEnd: Date;
  columnTitle: string;
  columnColor: string;
  colIndex: number;
}

type PackedRow = RoadmapTask[];

const DAY_MS = 1000 * 60 * 60 * 24;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Los_Angeles' });
}

function packRows(tasks: RoadmapTask[]): PackedRow[] {
  const rows: PackedRow[] = [];
  for (const task of tasks) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      if (last.barEnd.getTime() <= task.barStart.getTime()) {
        row.push(task);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([task]);
  }
  return rows;
}

const COL_COLORS = [
  { bg: 'bg-brand-light-pink', hex: '#F774B9' },
  { bg: 'bg-brand-blue', hex: '#5DC3F8' },
  { bg: 'bg-emerald-500', hex: '#10b981' },
  { bg: 'bg-amber-500', hex: '#f59e0b' },
  { bg: 'bg-violet-500', hex: '#8b5cf6' },
  { bg: 'bg-cyan-500', hex: '#06b6d4' },
  { bg: 'bg-rose-500', hex: '#f43f5e' },
  { bg: 'bg-brand-mid-pink', hex: '#EC67A1' },
];

const DAY_WIDTH = 40;
const LANE_HEADER = 32;
const LANE_GAP = 4;
const HEADER_HEIGHT = 56;
const MAX_CHART_HEIGHT = 600;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface LaneData {
  id: string;
  title: string;
  color: (typeof COL_COLORS)[0];
  tasks: RoadmapTask[];
  packedRows: PackedRow[];
}

export function TimelineTab({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
  onTaskClick,
}: SummaryTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ task: RoadmapTask; x: number; y: number } | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const allTasksList = Object.values(tasks);
  const autoCompact = allTasksList.length > 40;
  const effectiveRowHeight = compact || autoCompact ? 28 : 36;

  // Build roadmap data
  const { lanes, rangeStart, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    let earliest = addDays(today, -7);
    let latest = addDays(today, 30);

    const lanesArr: LaneData[] = [];

    columnOrder.forEach((colId, colIdx) => {
      const col = columns[colId];
      if (!col) return;
      const color = COL_COLORS[colIdx % COL_COLORS.length];
      const laneTasks: RoadmapTask[] = [];

      for (const taskId of col.taskIds) {
        const task = tasks[taskId];
        if (!task) continue;

        const createdRaw = task.metadata?._createdAt as string | undefined;
        const dueRaw = task.dueDate;

        const start = createdRaw ? startOfDay(new Date(createdRaw)) : today;
        const end = dueRaw ? startOfDay(new Date(dueRaw)) : addDays(start, 3);
        const safeEnd = end.getTime() <= start.getTime() ? addDays(start, 1) : end;

        if (start < earliest) earliest = start;
        if (safeEnd > latest) latest = safeEnd;

        laneTasks.push({
          ...task,
          barStart: start,
          barEnd: safeEnd,
          columnTitle: col.title,
          columnColor: color.hex,
          colIndex: colIdx,
        });
      }

      laneTasks.sort((a, b) => a.barStart.getTime() - b.barStart.getTime());

      lanesArr.push({
        id: colId,
        title: col.title,
        color,
        tasks: laneTasks,
        packedRows: packRows(laneTasks),
      });
    });

    const rangeStart = addDays(earliest, -3);
    addDays(latest, 7);
    const totalDays = diffDays(rangeStart, addDays(latest, 7));

    return { lanes: lanesArr, rangeStart, totalDays };
  }, [tasks, columns, columnOrder]);

  const totalWidth = totalDays * DAY_WIDTH;
  const today = startOfDay(new Date());
  const todayOffset = diffDays(rangeStart, today) * DAY_WIDTH;

  const toggleLane = useCallback((laneId: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  }, []);

  const getLaneContentHeight = useCallback(
    (lane: LaneData) => {
      if (collapsedLanes.has(lane.id)) return 0;
      return Math.max(lane.packedRows.length, 1) * effectiveRowHeight;
    },
    [collapsedLanes, effectiveRowHeight],
  );

  const totalChartHeight = lanes.reduce(
    (h, lane) => h + LANE_HEADER + getLaneContentHeight(lane) + LANE_GAP,
    0,
  );

  // Sync both panels on scroll
  const syncScroll = useCallback((source: 'chart' | 'left') => {
    const chart = scrollRef.current;
    const left = leftPanelRef.current;
    if (!chart || !left) return;
    if (source === 'chart') {
      left.scrollTop = chart.scrollTop;
    } else {
      chart.scrollTop = left.scrollTop;
    }
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - containerWidth / 3);
    }
  }, [todayOffset]);

  const scroll = useCallback((dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -7 * DAY_WIDTH : 7 * DAY_WIDTH, behavior: 'smooth' });
  }, []);

  const dayColumns = useMemo(() => {
    const days: { date: Date; isToday: boolean; isWeekend: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i);
      days.push({
        date: d,
        isToday: d.getTime() === today.getTime(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    return days;
  }, [rangeStart, totalDays, today]);

  const monthHeaders = useMemo(() => {
    const months: { label: string; widthPx: number }[] = [];
    let currentMonth = '';
    let startIdx = 0;
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(rangeStart, i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== currentMonth) {
        if (currentMonth && i > startIdx) {
          months.push({
            label: formatMonthYear(addDays(rangeStart, startIdx)),
            widthPx: (i - startIdx) * DAY_WIDTH,
          });
        }
        currentMonth = key;
        startIdx = i;
      }
    }
    if (totalDays > startIdx) {
      months.push({
        label: formatMonthYear(addDays(rangeStart, startIdx)),
        widthPx: (totalDays - startIdx) * DAY_WIDTH,
      });
    }
    return months;
  }, [rangeStart, totalDays]);

  const overdueTasks = allTasksList.filter((t) => t.dueDate && new Date(t.dueDate) < today);

  const laneYOffsets = useMemo(() => {
    const offsets: number[] = [];
    let y = 0;
    for (const lane of lanes) {
      offsets.push(y);
      y += LANE_HEADER + getLaneContentHeight(lane) + LANE_GAP;
    }
    return offsets;
  }, [lanes, getLaneContentHeight]);

  // The body area height (below sticky headers) that the chart content + grid lines occupy
  const bodyHeight = totalChartHeight;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60">
      {/* Top accent */}
      <div className="h-[3px] rounded-t-2xl bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
        <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-light-pink" />
          Roadmap
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          {overdueTasks.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {overdueTasks.length} overdue
            </span>
          )}
          <span className="text-[11px] text-gray-500">
            {allTasksList.length} task{allTasksList.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-gray-500 border border-white/[0.08] rounded px-1.5 py-0.5">
            PST (Los Angeles)
          </span>
          <button
            onClick={() => setCompact((p) => !p)}
            className={`p-1 rounded transition-colors ${
              compact || autoCompact
                ? 'text-brand-light-pink bg-brand-light-pink/10'
                : 'text-gray-400 hover:bg-white/[0.08] hover:text-white'
            }`}
            title={compact ? 'Normal view' : 'Compact view'}
          >
            {compact || autoCompact ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              if (collapsedLanes.size === lanes.length) setCollapsedLanes(new Set());
              else setCollapsedLanes(new Set(lanes.map((l) => l.id)));
            }}
            className="px-2 py-0.5 rounded text-[10px] font-semibold text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            {collapsedLanes.size === lanes.length ? 'Expand All' : 'Collapse All'}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => scroll('left')} className="p-1 rounded hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({ left: Math.max(0, todayOffset - scrollRef.current.clientWidth / 3), behavior: 'smooth' });
                }
              }}
              className="px-2 py-0.5 rounded text-[11px] font-semibold text-brand-light-pink hover:bg-brand-light-pink/10 transition-colors"
            >
              Today
            </button>
            <button onClick={() => scroll('right')} className="p-1 rounded hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {allTasksList.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-[13px] text-gray-500">No tasks to display on the roadmap</p>
        </div>
      ) : (
        <div className="flex" style={{ height: Math.min(totalChartHeight + HEADER_HEIGHT, MAX_CHART_HEIGHT) }}>
          {/* ── Frozen left panel ── */}
          <div className="shrink-0 w-[180px] border-r border-white/[0.06] bg-[#0f1729] flex flex-col">
            {/* Sticky header spacer */}
            <div className="shrink-0 border-b border-white/[0.06]" style={{ height: HEADER_HEIGHT }} />

            {/* Scrollable lane labels — synced with chart */}
            <div
              ref={leftPanelRef}
              className="flex-1 overflow-y-auto overflow-x-hidden"
              style={{ scrollbarWidth: 'none' }}
              onScroll={() => syncScroll('left')}
            >
              <div style={{ height: bodyHeight }}>
                {lanes.map((lane) => {
                  const isCollapsed = collapsedLanes.has(lane.id);
                  const contentH = getLaneContentHeight(lane);
                  return (
                    <div
                      key={lane.id}
                      className="border-b border-white/[0.04]"
                      style={{ height: LANE_HEADER + contentH + LANE_GAP }}
                    >
                      <button
                        onClick={() => toggleLane(lane.id)}
                        className="flex items-center gap-1.5 px-3 w-full hover:bg-white/[0.03] transition-colors"
                        style={{ height: LANE_HEADER }}
                      >
                        <ChevronDown
                          className={`w-3 h-3 text-gray-500 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                        />
                        <span className={`w-2 h-2 rounded-full shrink-0 ${lane.color.bg}`} />
                        <span className="text-[11px] font-semibold text-gray-300 truncate">
                          {lane.title}
                        </span>
                        <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                          {lane.tasks.length}
                        </span>
                      </button>

                      {!isCollapsed &&
                        lane.packedRows.map((row, rowIdx) => (
                          <div
                            key={rowIdx}
                            className="flex items-center px-3 pl-7 truncate"
                            style={{ height: effectiveRowHeight }}
                          >
                            {row.length === 1 ? (
                              <>
                                <span className="text-[9px] text-gray-600 mr-1 shrink-0">{row[0].taskKey}</span>
                                <span className="text-[10px] text-gray-400 truncate">{row[0].title}</span>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-500">{row.length} tasks</span>
                            )}
                          </div>
                        ))}
                      {!isCollapsed && lane.packedRows.length === 0 && (
                        <div className="flex items-center px-3 pl-7" style={{ height: effectiveRowHeight }}>
                          <span className="text-[10px] text-gray-600 italic">No tasks</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Scrollable chart area ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Sticky headers (not inside the scroll container so they don't shift vertically) */}
            <div className="shrink-0 overflow-hidden" style={{ height: HEADER_HEIGHT }}>
              <div style={{ width: totalWidth }} ref={(el) => {
                // Sync horizontal scroll of sticky headers with chart body
                if (!el) return;
                const chart = scrollRef.current;
                if (chart) {
                  const obs = new MutationObserver(() => {});
                  // We use onScroll below instead
                  obs.disconnect();
                }
              }}>
                {/* We'll overlay the header in the chart scroll for horizontal sync */}
              </div>
            </div>

            {/* The whole chart with headers that scroll horizontally but are visually sticky vertically */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto"
              onScroll={() => {
                syncScroll('chart');
                // Sync the sticky header horizontal offset
                const chart = scrollRef.current;
                const hdr = chart?.previousElementSibling as HTMLElement | null;
                if (chart && hdr) {
                  hdr.scrollLeft = chart.scrollLeft;
                }
              }}
              style={{ marginTop: -HEADER_HEIGHT }}
            >
              <div style={{ width: totalWidth, height: bodyHeight + HEADER_HEIGHT }} className="relative">
                {/* Month headers */}
                <div className="flex sticky top-0 bg-[#0f1729] z-20 border-b border-white/[0.06]" style={{ height: 28 }}>
                  {monthHeaders.map((m, i) => (
                    <div key={i} className="shrink-0 flex items-center px-2 border-r border-white/[0.04]" style={{ width: m.widthPx }}>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day headers */}
                <div className="flex sticky top-[28px] bg-[#0f1729] z-20 border-b border-white/[0.06]" style={{ height: 28 }}>
                  {dayColumns.map((day, i) => (
                    <div
                      key={i}
                      className={`shrink-0 flex items-center justify-center border-r text-[9px] font-medium ${
                        day.isToday
                          ? 'bg-brand-light-pink/15 text-brand-light-pink border-brand-light-pink/20'
                          : day.isWeekend
                            ? 'text-gray-600 border-white/[0.03] bg-white/[0.01]'
                            : 'text-gray-500 border-white/[0.04]'
                      }`}
                      style={{ width: DAY_WIDTH }}
                    >
                      {day.date.getDate()}
                    </div>
                  ))}
                </div>

                {/* ── Chart body (below sticky headers) ── */}
                <div className="relative" style={{ height: bodyHeight }}>
                  {/* Weekend shading */}
                  {dayColumns.map((day, i) =>
                    day.isWeekend ? (
                      <div
                        key={`w-${i}`}
                        className="absolute bg-white/[0.015] pointer-events-none"
                        style={{ left: i * DAY_WIDTH, width: DAY_WIDTH, top: 0, height: bodyHeight }}
                      />
                    ) : null,
                  )}

                  {/* Today line */}
                  <div
                    className="absolute w-px bg-brand-light-pink/30 z-[5] pointer-events-none"
                    style={{ left: todayOffset + DAY_WIDTH / 2, top: 0, height: bodyHeight }}
                  >
                    <div className="absolute top-0 -translate-x-1/2 bg-brand-light-pink text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      TODAY
                    </div>
                  </div>

                  {/* Swim lanes */}
                  {lanes.map((lane, laneIdx) => {
                    const isCollapsed = collapsedLanes.has(lane.id);
                    const contentH = getLaneContentHeight(lane);
                    const laneY = laneYOffsets[laneIdx];

                    return (
                      <div
                        key={lane.id}
                        className="absolute w-full border-b border-white/[0.04]"
                        style={{ top: laneY, height: LANE_HEADER + contentH + LANE_GAP }}
                      >
                        {/* Lane header stripe */}
                        <div
                          className="w-full border-b border-white/[0.03]"
                          style={{ height: LANE_HEADER, background: `linear-gradient(90deg, ${lane.color.hex}08, transparent)` }}
                        />

                        {/* Task bars */}
                        {!isCollapsed &&
                          lane.packedRows.map((row, rowIdx) =>
                            row.map((task) => {
                              const offsetDays = diffDays(rangeStart, task.barStart);
                              const durationDays = Math.max(1, diffDays(task.barStart, task.barEnd));
                              const left = offsetDays * DAY_WIDTH;
                              const width = durationDays * DAY_WIDTH;
                              const overdue = task.dueDate && new Date(task.dueDate) < today;
                              const assigneeName = resolveMemberName(task.assignee);

                              const totalMs = task.barEnd.getTime() - task.barStart.getTime();
                              const elapsedMs = Math.min(Date.now() - task.barStart.getTime(), totalMs);
                              const progress = totalMs > 0 ? Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100)) : 0;

                              const barPad = effectiveRowHeight <= 28 ? 3 : 5;

                              return (
                                <div
                                  key={task.id}
                                  className="absolute"
                                  style={{
                                    top: LANE_HEADER + rowIdx * effectiveRowHeight + barPad,
                                    left,
                                    width: Math.max(width, DAY_WIDTH),
                                    height: effectiveRowHeight - barPad * 2,
                                  }}
                                >
                                  <div
                                    className={`relative w-full h-full rounded-md border cursor-pointer transition-all hover:brightness-125 hover:shadow-lg ${
                                      overdue
                                        ? 'border-red-500/40 bg-red-500/20'
                                        : 'border-white/[0.12] bg-white/[0.06]'
                                    }`}
                                    onClick={() => onTaskClick?.(task)}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTooltip({
                                        task,
                                        x: Math.min(rect.left + rect.width / 2, window.innerWidth - 140),
                                        y: rect.top,
                                      });
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                  >
                                    <div
                                      className={`absolute inset-0 rounded-md ${overdue ? 'bg-red-500/30' : ''}`}
                                      style={{
                                        width: `${progress}%`,
                                        background: overdue ? undefined : `linear-gradient(90deg, ${lane.color.hex}40, ${lane.color.hex}20)`,
                                      }}
                                    />
                                    <div className="relative flex items-center gap-1 px-1.5 h-full overflow-hidden z-[1]">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${overdue ? 'bg-red-400' : lane.color.bg}`} />
                                      <span className="text-[9px] font-semibold text-white truncate">{task.title}</span>
                                      {assigneeName && width > 140 && (
                                        <span className="text-[8px] text-gray-400 truncate ml-auto shrink-0 flex items-center gap-0.5">
                                          <User className="w-2.5 h-2.5" />
                                          {assigneeName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }),
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip — portalled to body so it's never clipped by overflow */}
      {mounted && tooltip && createPortal(
        <RoadmapTooltip task={tooltip.task} x={tooltip.x} y={tooltip.y} resolveMemberName={resolveMemberName} />,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tooltip (rendered in portal)                                       */
/* ------------------------------------------------------------------ */

function RoadmapTooltip({
  task,
  x,
  y,
  resolveMemberName,
}: {
  task: RoadmapTask;
  x: number;
  y: number;
  resolveMemberName: (id?: string) => string | undefined;
}) {
  const assigneeName = resolveMemberName(task.assignee);
  const overdue = task.dueDate && new Date(task.dueDate) < new Date();
  const duration = diffDays(task.barStart, task.barEnd);

  // Position above the bar, clamped within viewport
  const tooltipStyle: React.CSSProperties = {
    left: x,
    top: y - 8,
    transform: 'translate(-50%, -100%)',
  };

  return (
    <div className="fixed z-[99999] pointer-events-none" style={tooltipStyle}>
      <div className="bg-[#1a2237] border border-white/[0.12] rounded-lg shadow-xl shadow-black/50 px-3 py-2.5 max-w-[260px]">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-bold text-brand-light-pink/60">{task.taskKey}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5 bg-brand-mid-pink/10 text-brand-mid-pink border border-brand-mid-pink/20">
            {task.columnTitle}
          </span>
        </div>
        <p className="text-[12px] font-medium text-white mb-2 line-clamp-2">{task.title}</p>
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Created</span>
            <span className="text-gray-300">{formatShortDate(task.barStart)} <span className="text-gray-500">PST</span></span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Launching Date</span>
            <span className={overdue ? 'text-red-400 font-semibold' : 'text-gray-300'}>
              {task.dueDate ? <>{formatShortDate(task.barEnd)} <span className="text-gray-500">PST</span></> : 'No launching date'}
              {overdue && ' (overdue)'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Duration</span>
            <span className="text-gray-300">{duration} day{duration !== 1 ? 's' : ''}</span>
          </div>
          {assigneeName && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Assignee</span>
              <span className="text-gray-300">{assigneeName}</span>
            </div>
          )}
          {task.priority && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Priority</span>
              <span className={task.priority === 'Urgent' ? 'text-red-400' : task.priority === 'Normal' ? 'text-amber-400' : 'text-emerald-400'}>
                {task.priority}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-center">
        <div className="w-2 h-2 bg-[#1a2237] border-r border-b border-white/[0.12] rotate-45 -mt-1" />
      </div>
    </div>
  );
}
