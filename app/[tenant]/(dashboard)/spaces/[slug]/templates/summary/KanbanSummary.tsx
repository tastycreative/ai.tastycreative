'use client';

import {
  LayoutGrid,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Flag,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import { StatCard, DistributionBar, SummarySection, ListRow } from './StatCard';

export function KanbanSummary({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
}: SummaryTabProps) {
  const allTasks = Object.values(tasks);
  const totalTasks = allTasks.length;

  // Tasks per column
  const columnStats = columnOrder
    .map((colId) => {
      const col = columns[colId];
      if (!col) return null;
      return { label: col.title, count: col.taskIds.length, id: colId };
    })
    .filter(Boolean) as { label: string; count: number; id: string }[];

  // Completion: last column is considered "done"
  const lastColId = columnOrder[columnOrder.length - 1];
  const completedCount = lastColId ? (columns[lastColId]?.taskIds.length ?? 0) : 0;

  // Overdue
  const now = new Date();
  const overdueTasks = allTasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < now && t.id !== lastColId;
  });

  // Priority distribution
  const priorityMap: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
  for (const t of allTasks) {
    if (t.priority && priorityMap[t.priority] !== undefined) {
      priorityMap[t.priority]++;
    }
  }
  const hasPriority = Object.values(priorityMap).some((v) => v > 0);

  // Assignee workload
  const assigneeMap: Record<string, number> = {};
  for (const t of allTasks) {
    const name = resolveMemberName(t.assignee) ?? 'Unassigned';
    assigneeMap[name] = (assigneeMap[name] ?? 0) + 1;
  }
  const assigneeEntries = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]);

  // Column distribution colors
  const colColors = [
    'bg-brand-light-pink',
    'bg-brand-blue',
    'bg-brand-mid-pink',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-violet-500',
    'bg-cyan-500',
    'bg-rose-500',
  ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      {/* Top accent */}
      <div className="h-[3px] bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Tasks"
            value={totalTasks}
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            accent="blue"
          />
          <StatCard
            label="Completed"
            value={completedCount}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            accent="green"
            sub={totalTasks > 0 ? `${Math.round((completedCount / totalTasks) * 100)}% done` : undefined}
          />
          <StatCard
            label="In Progress"
            value={totalTasks - completedCount}
            icon={<Clock className="w-3.5 h-3.5" />}
            accent="pink"
          />
          <StatCard
            label="Overdue"
            value={overdueTasks.length}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            accent={overdueTasks.length > 0 ? 'amber' : 'default'}
          />
        </div>

        {/* Column Distribution */}
        <SummarySection title="Column Distribution">
          <DistributionBar
            items={columnStats.map((s, i) => ({
              label: s.label,
              count: s.count,
              color: colColors[i % colColors.length],
            }))}
            total={totalTasks}
          />
        </SummarySection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Priority Breakdown */}
          {hasPriority && (
            <SummarySection title="Priority Breakdown">
              <div className="space-y-1.5">
                <ListRow label="High" value={priorityMap.High} accent="text-red-400" />
                <ListRow label="Medium" value={priorityMap.Medium} accent="text-amber-400" />
                <ListRow label="Low" value={priorityMap.Low} accent="text-emerald-400" />
              </div>
            </SummarySection>
          )}

          {/* Assignee Workload */}
          <SummarySection title="Assignee Workload">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {assigneeEntries.length === 0 ? (
                <p className="text-[12px] text-gray-500">No tasks yet</p>
              ) : (
                assigneeEntries.map(([name, count]) => (
                  <ListRow key={name} label={name} value={count} />
                ))
              )}
            </div>
          </SummarySection>
        </div>

        {/* Per-column task counts */}
        <SummarySection title="Column Breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {columnStats.map((col, i) => (
              <div
                key={col.id}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
              >
                <span className={`w-2 h-2 rounded-full ${colColors[i % colColors.length]}`} />
                <span className="text-[12px] text-gray-400 truncate flex-1">{col.label}</span>
                <span className="text-[13px] font-semibold text-white">{col.count}</span>
              </div>
            ))}
          </div>
        </SummarySection>
      </div>
    </div>
  );
}
