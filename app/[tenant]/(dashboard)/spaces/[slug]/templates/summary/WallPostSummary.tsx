'use client';

import {
  LayoutGrid,
  Image,
  Calendar,
  MessageSquare,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import { StatCard, DistributionBar, SummarySection, ListRow } from './StatCard';

export function WallPostSummary({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
}: SummaryTabProps) {
  const allTasks = Object.values(tasks);
  const totalPosts = allTasks.length;

  // Platform distribution
  const platformMap: Record<string, number> = {};
  for (const t of allTasks) {
    const platform = (t.metadata?.platform as string) || 'Unset';
    platformMap[platform] = (platformMap[platform] ?? 0) + 1;
  }

  // Posts with schedules
  const scheduledCount = allTasks.filter(
    (t) => t.metadata?.scheduledDate || t.dueDate,
  ).length;

  // Caption status distribution
  const captionStatusMap: Record<string, number> = {};
  for (const t of allTasks) {
    const status = (t.metadata?.captionStatus as string) || (t.metadata?.wallPostStatus as string) || 'pending';
    captionStatusMap[status] = (captionStatusMap[status] ?? 0) + 1;
  }

  // Total media count
  const totalMedia = allTasks.reduce(
    (sum, t) => sum + ((t.metadata?.mediaCount as number) || 0),
    0,
  );

  // Model distribution
  const modelMap: Record<string, number> = {};
  for (const t of allTasks) {
    const model = (t.metadata?.model as string) || resolveMemberName(t.assignee) || 'Unassigned';
    modelMap[model] = (modelMap[model] ?? 0) + 1;
  }
  const modelEntries = Object.entries(modelMap).sort((a, b) => b[1] - a[1]);

  // Column stats
  const columnStats = columnOrder
    .map((colId) => {
      const col = columns[colId];
      if (!col) return null;
      return { label: col.title, count: col.taskIds.length };
    })
    .filter(Boolean) as { label: string; count: number }[];

  // Posted count (last column assumed "posted")
  const lastColId = columnOrder[columnOrder.length - 1];
  const postedCount = lastColId ? (columns[lastColId]?.taskIds.length ?? 0) : 0;

  const platformColors: Record<string, string> = {
    onlyfans: 'bg-brand-blue',
    fansly: 'bg-brand-light-pink',
    Unset: 'bg-gray-500',
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Posts"
            value={totalPosts}
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            accent="blue"
          />
          <StatCard
            label="Posted"
            value={postedCount}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            accent="green"
            sub={totalPosts > 0 ? `${Math.round((postedCount / totalPosts) * 100)}%` : undefined}
          />
          <StatCard
            label="Scheduled"
            value={scheduledCount}
            icon={<Calendar className="w-3.5 h-3.5" />}
            accent="pink"
          />
          <StatCard
            label="Total Media"
            value={totalMedia}
            icon={<Image className="w-3.5 h-3.5" />}
            accent="violet"
          />
        </div>

        {/* Platform Distribution */}
        {Object.keys(platformMap).length > 0 && (
          <SummarySection title="Platform Distribution">
            <DistributionBar
              items={Object.entries(platformMap).map(([platform, count]) => ({
                label: platform,
                count,
                color: platformColors[platform.toLowerCase()] ?? 'bg-gray-500',
              }))}
              total={totalPosts}
            />
          </SummarySection>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Caption Status */}
          <SummarySection title="Caption Status">
            <div className="space-y-1.5">
              {Object.entries(captionStatusMap).map(([status, count]) => (
                <ListRow
                  key={status}
                  label={status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  value={count}
                  accent={
                    status === 'approved' ? 'text-emerald-400' :
                    status === 'rejected' ? 'text-red-400' :
                    status === 'submitted' ? 'text-brand-blue' :
                    'text-gray-300'
                  }
                />
              ))}
            </div>
          </SummarySection>

          {/* Model Distribution */}
          <SummarySection title="Model / Assignee">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {modelEntries.length === 0 ? (
                <p className="text-[12px] text-gray-500">No posts yet</p>
              ) : (
                modelEntries.map(([name, count]) => (
                  <ListRow key={name} label={name} value={count} />
                ))
              )}
            </div>
          </SummarySection>
        </div>

        {/* Column Breakdown */}
        <SummarySection title="Column Breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {columnStats.map((col) => (
              <div
                key={col.label}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
              >
                <span className="w-2 h-2 rounded-full bg-brand-mid-pink" />
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
