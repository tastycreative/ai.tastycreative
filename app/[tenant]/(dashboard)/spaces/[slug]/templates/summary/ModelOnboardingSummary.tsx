'use client';

import {
  Users,
  CheckCircle2,
  ListChecks,
  Globe,
  LayoutGrid,
  TrendingUp,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import { StatCard, DistributionBar, SummarySection, ListRow } from './StatCard';

interface ChecklistItem {
  label: string;
  completed: boolean;
}

export function ModelOnboardingSummary({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
}: SummaryTabProps) {
  const allTasks = Object.values(tasks);
  const totalModels = allTasks.length;

  // Checklist aggregate stats
  let totalChecklistItems = 0;
  let totalChecklistCompleted = 0;
  const checklistLabelMap: Record<string, { total: number; completed: number }> = {};

  for (const t of allTasks) {
    const checklist = (t.metadata?.checklist as ChecklistItem[]) ?? [];
    totalChecklistItems += checklist.length;
    for (const item of checklist) {
      if (item.completed) totalChecklistCompleted++;
      if (!checklistLabelMap[item.label]) {
        checklistLabelMap[item.label] = { total: 0, completed: 0 };
      }
      checklistLabelMap[item.label].total++;
      if (item.completed) checklistLabelMap[item.label].completed++;
    }
  }

  const avgProgress =
    totalChecklistItems > 0
      ? Math.round((totalChecklistCompleted / totalChecklistItems) * 100)
      : 0;

  // Models fully onboarded (all checklist items complete)
  const fullyOnboarded = allTasks.filter((t) => {
    const checklist = (t.metadata?.checklist as ChecklistItem[]) ?? [];
    return checklist.length > 0 && checklist.every((c) => c.completed);
  }).length;

  // Platform distribution
  const platformMap: Record<string, number> = {};
  for (const t of allTasks) {
    const platform = (t.metadata?.platform as string) || 'Unset';
    platformMap[platform] = (platformMap[platform] ?? 0) + 1;
  }

  // Assignee workload
  const assigneeMap: Record<string, number> = {};
  for (const t of allTasks) {
    const name = resolveMemberName(t.assignee) ?? 'Unassigned';
    assigneeMap[name] = (assigneeMap[name] ?? 0) + 1;
  }
  const assigneeEntries = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]);

  // Column stats
  const columnStats = columnOrder
    .map((colId) => {
      const col = columns[colId];
      if (!col) return null;
      return { label: col.title, count: col.taskIds.length };
    })
    .filter(Boolean) as { label: string; count: number }[];

  // Checklist item completion rates — top items
  const checklistEntries = Object.entries(checklistLabelMap)
    .map(([label, { total, completed }]) => ({
      label,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate); // worst first

  const colColors = [
    'bg-brand-light-pink',
    'bg-brand-blue',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-violet-500',
    'bg-cyan-500',
  ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Models"
            value={totalModels}
            icon={<Users className="w-3.5 h-3.5" />}
            accent="blue"
          />
          <StatCard
            label="Fully Onboarded"
            value={fullyOnboarded}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            accent="green"
            sub={totalModels > 0 ? `${Math.round((fullyOnboarded / totalModels) * 100)}%` : undefined}
          />
          <StatCard
            label="Avg Progress"
            value={`${avgProgress}%`}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            accent="pink"
          />
          <StatCard
            label="Checklist Steps"
            value={totalChecklistItems > 0 ? `${totalChecklistCompleted}/${totalChecklistItems}` : '0'}
            icon={<ListChecks className="w-3.5 h-3.5" />}
            accent="violet"
          />
        </div>

        {/* Onboarding Stage Distribution */}
        <SummarySection title="Onboarding Stages">
          <DistributionBar
            items={columnStats.map((s, i) => ({
              label: s.label,
              count: s.count,
              color: colColors[i % colColors.length],
            }))}
            total={totalModels}
          />
        </SummarySection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Checklist Completion */}
          {checklistEntries.length > 0 && (
            <SummarySection title="Checklist Step Completion">
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {checklistEntries.map((entry) => (
                  <div
                    key={entry.label}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-gray-400 truncate flex-1">
                        {entry.label}
                      </span>
                      <span className={`text-[12px] font-semibold ${
                        entry.rate >= 80 ? 'text-emerald-400' :
                        entry.rate >= 50 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {entry.rate}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          entry.rate >= 80 ? 'bg-emerald-500' :
                          entry.rate >= 50 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${entry.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SummarySection>
          )}

          {/* Assignee Workload */}
          <SummarySection title="Assignee Workload">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {assigneeEntries.length === 0 ? (
                <p className="text-[12px] text-gray-500">No models yet</p>
              ) : (
                assigneeEntries.map(([name, count]) => (
                  <ListRow key={name} label={name} value={count} />
                ))
              )}
            </div>
          </SummarySection>
        </div>

        {/* Platform Distribution */}
        {Object.keys(platformMap).length > 1 && (
          <SummarySection title="Platform">
            <div className="space-y-1.5">
              {Object.entries(platformMap).map(([platform, count]) => (
                <ListRow
                  key={platform}
                  label={platform}
                  value={count}
                  accent={platform.toLowerCase() === 'onlyfans' ? 'text-brand-blue' : 'text-brand-light-pink'}
                />
              ))}
            </div>
          </SummarySection>
        )}

        {/* Column Breakdown */}
        <SummarySection title="Column Breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {columnStats.map((col, i) => (
              <div
                key={col.label}
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
