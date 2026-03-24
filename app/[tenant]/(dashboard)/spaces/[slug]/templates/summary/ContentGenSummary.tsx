'use client';

import {
  Clapperboard,
  LayoutGrid,
  CheckCircle2,
  Users,
  FolderOpen,
  Clock,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import { StatCard, DistributionBar, SummarySection, ListRow } from './StatCard';
import type { VaultAssetRef, ContentGenTaskType } from '@/lib/spaces/template-metadata';

const TYPE_COLORS: Record<string, string> = {
  IG_SFW_REELS: 'bg-blue-500',
  NSFW_PPV: 'bg-rose-500',
  WALL_POSTS: 'bg-violet-500',
  STORIES: 'bg-amber-500',
  PROMO: 'bg-emerald-500',
  CUSTOM: 'bg-gray-500',
};

const TYPE_LABELS: Record<string, string> = {
  IG_SFW_REELS: 'IG SFW Reels',
  NSFW_PPV: 'NSFW PPV',
  WALL_POSTS: 'Wall Posts',
  STORIES: 'Stories',
  PROMO: 'Promo',
  CUSTOM: 'Custom',
};

export function ContentGenSummary({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
}: SummaryTabProps) {
  const allTasks = Object.values(tasks);
  const totalItems = allTasks.length;

  // Task type distribution
  const typeMap: Record<string, number> = {};
  for (const t of allTasks) {
    const type = (t.metadata?.taskType as string) || 'CUSTOM';
    typeMap[type] = (typeMap[type] ?? 0) + 1;
  }
  const typeDistribution = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label: TYPE_LABELS[label] ?? label,
      count,
      color: TYPE_COLORS[label] ?? 'bg-gray-500',
    }));

  // Total quantity
  let totalQuantity = 0;
  for (const t of allTasks) {
    totalQuantity += (t.metadata?.quantity as number) || 1;
  }

  // Total vault assets
  let totalVaultAssets = 0;
  for (const t of allTasks) {
    const assets = Array.isArray(t.metadata?.vaultAssets) ? t.metadata!.vaultAssets as VaultAssetRef[] : [];
    totalVaultAssets += assets.length;
  }

  // Tasks with assets vs without
  const tasksWithAssets = allTasks.filter(
    (t) => Array.isArray(t.metadata?.vaultAssets) && (t.metadata!.vaultAssets as VaultAssetRef[]).length > 0,
  ).length;

  // Client distribution
  const clientMap: Record<string, number> = {};
  for (const t of allTasks) {
    const client = (t.metadata?.clientName as string) || 'Unknown';
    clientMap[client] = (clientMap[client] ?? 0) + 1;
  }
  const topClients = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Assignee workload
  const assigneeMap: Record<string, number> = {};
  for (const t of allTasks) {
    const assignedTo = Array.isArray(t.metadata?.assignedTo) ? (t.metadata!.assignedTo as string[]) : [];
    if (assignedTo.length === 0) {
      assigneeMap['Unassigned'] = (assigneeMap['Unassigned'] ?? 0) + 1;
    } else {
      for (const uid of assignedTo) {
        const name = resolveMemberName(uid) ?? uid;
        assigneeMap[name] = (assigneeMap[name] ?? 0) + 1;
      }
    }
  }
  const assigneeEntries = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]);

  // Overdue tasks
  const overdueTasks = allTasks.filter((t) => {
    const deadline = (t.metadata?.deadline as string) || t.dueDate;
    if (!deadline) return false;
    return new Date(deadline).getTime() < Date.now();
  }).length;

  // Completed (last column)
  const lastColId = columnOrder[columnOrder.length - 1];
  const completedCount = lastColId ? (columns[lastColId]?.taskIds.length ?? 0) : 0;

  // Column stats
  const columnStats = columnOrder
    .map((colId) => {
      const col = columns[colId];
      if (!col) return null;
      return { name: col.title, count: col.taskIds.length };
    })
    .filter(Boolean) as { name: string; count: number }[];

  return (
    <div className="space-y-6 p-1">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Tasks"
          value={totalItems}
          icon={<LayoutGrid className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Total Quantity"
          value={totalQuantity}
          icon={<Clapperboard className="h-4 w-4" />}
          accent="pink"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
          sub={totalItems > 0 ? `${Math.round((completedCount / totalItems) * 100)}%` : '0%'}
        />
        <StatCard
          label="Vault Assets"
          value={totalVaultAssets}
          icon={<FolderOpen className="h-4 w-4" />}
          accent="violet"
          sub={`${tasksWithAssets} of ${totalItems} tasks`}
        />
        <StatCard
          label="Overdue"
          value={overdueTasks}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Assignees"
          value={Object.keys(assigneeMap).filter((k) => k !== 'Unassigned').length}
          icon={<Users className="h-4 w-4" />}
          accent="default"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Task Type Distribution */}
        <SummarySection title="Task Type Distribution">
          <DistributionBar items={typeDistribution} total={totalItems} />
        </SummarySection>

        {/* Column Breakdown */}
        <SummarySection title="Pipeline Status">
          <div className="space-y-1">
            {columnStats.map((col) => (
              <ListRow key={col.name} label={col.name} value={col.count} />
            ))}
          </div>
        </SummarySection>

        {/* Top Clients */}
        <SummarySection title="Top Clients">
          <div className="space-y-1">
            {topClients.length > 0 ? (
              topClients.map(([client, count]) => (
                <ListRow key={client} label={client} value={count} />
              ))
            ) : (
              <p className="text-xs text-gray-600">No client data</p>
            )}
          </div>
        </SummarySection>

        {/* Assignee Workload */}
        <SummarySection title="Assignee Workload">
          <div className="space-y-1">
            {assigneeEntries.map(([name, count]) => (
              <ListRow
                key={name}
                label={name}
                value={count}
                accent={name === 'Unassigned' ? 'text-gray-500' : undefined}
              />
            ))}
          </div>
        </SummarySection>
      </div>
    </div>
  );
}