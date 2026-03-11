'use client';

import {
  LayoutGrid,
  Layers,
  Image,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import { StatCard, DistributionBar, SummarySection, ListRow } from './StatCard';

export function SextingSetsSummary({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
}: SummaryTabProps) {
  const allTasks = Object.values(tasks);
  const totalSets = allTasks.length;

  // Category distribution
  const categoryMap: Record<string, number> = {};
  for (const t of allTasks) {
    const category = (t.metadata?.category as string) || 'Uncategorized';
    categoryMap[category] = (categoryMap[category] ?? 0) + 1;
  }
  const categoryEntries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  // Quality distribution
  const qualityMap: Record<string, number> = { '4K': 0, HD: 0, SD: 0 };
  for (const t of allTasks) {
    const quality = (t.metadata?.quality as string) || 'SD';
    qualityMap[quality] = (qualityMap[quality] ?? 0) + 1;
  }

  // Total photos (setSize)
  const totalPhotos = allTasks.reduce(
    (sum, t) => sum + ((t.metadata?.setSize as number) || 0),
    0,
  );

  // Watermarked count
  const watermarkedCount = allTasks.filter((t) => t.metadata?.watermarked === true).length;

  // Model distribution
  const modelMap: Record<string, number> = {};
  for (const t of allTasks) {
    const model = (t.metadata?.model as string) || resolveMemberName(t.assignee) || 'Unassigned';
    modelMap[model] = (modelMap[model] ?? 0) + 1;
  }
  const modelEntries = Object.entries(modelMap).sort((a, b) => b[1] - a[1]);

  // Tag frequency
  const tagMap: Record<string, number> = {};
  for (const t of allTasks) {
    const tags = (t.metadata?.tags as string[]) ?? t.tags ?? [];
    for (const tag of tags) {
      tagMap[tag] = (tagMap[tag] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const categoryColors = [
    'bg-brand-light-pink',
    'bg-brand-blue',
    'bg-violet-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
  ];

  // Column stats
  const columnStats = columnOrder
    .map((colId) => {
      const col = columns[colId];
      if (!col) return null;
      return { label: col.title, count: col.taskIds.length };
    })
    .filter(Boolean) as { label: string; count: number }[];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Sets"
            value={totalSets}
            icon={<Layers className="w-3.5 h-3.5" />}
            accent="pink"
          />
          <StatCard
            label="Total Photos"
            value={totalPhotos}
            icon={<Image className="w-3.5 h-3.5" />}
            accent="blue"
          />
          <StatCard
            label="Avg Set Size"
            value={totalSets > 0 ? Math.round(totalPhotos / totalSets) : 0}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            accent="violet"
          />
          <StatCard
            label="Watermarked"
            value={watermarkedCount}
            icon={<Tag className="w-3.5 h-3.5" />}
            accent="green"
            sub={totalSets > 0 ? `${Math.round((watermarkedCount / totalSets) * 100)}%` : undefined}
          />
        </div>

        {/* Category Distribution */}
        {categoryEntries.length > 0 && (
          <SummarySection title="Category Distribution">
            <DistributionBar
              items={categoryEntries.map(([label, count], i) => ({
                label,
                count,
                color: categoryColors[i % categoryColors.length],
              }))}
              total={totalSets}
            />
          </SummarySection>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quality Breakdown */}
          <SummarySection title="Quality Breakdown">
            <div className="space-y-1.5">
              <ListRow label="4K" value={qualityMap['4K']} accent="text-brand-blue" />
              <ListRow label="HD" value={qualityMap.HD} accent="text-brand-light-pink" />
              <ListRow label="SD" value={qualityMap.SD} accent="text-gray-400" />
            </div>
          </SummarySection>

          {/* Model Distribution */}
          <SummarySection title="Model / Assignee">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {modelEntries.length === 0 ? (
                <p className="text-[12px] text-gray-500">No sets yet</p>
              ) : (
                modelEntries.map(([name, count]) => (
                  <ListRow key={name} label={name} value={count} />
                ))
              )}
            </div>
          </SummarySection>
        </div>

        {/* Top Tags */}
        {topTags.length > 0 && (
          <SummarySection title="Popular Tags">
            <div className="flex flex-wrap gap-2">
              {topTags.map(([tag, count]) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 bg-brand-light-pink/10 text-brand-light-pink border border-brand-light-pink/20"
                >
                  {tag}
                  <span className="text-gray-500">({count})</span>
                </span>
              ))}
            </div>
          </SummarySection>
        )}

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
