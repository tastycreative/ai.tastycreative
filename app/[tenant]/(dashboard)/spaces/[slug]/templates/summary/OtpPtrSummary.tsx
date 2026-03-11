'use client';

import {
  DollarSign,
  LayoutGrid,
  CheckCircle2,
  ShoppingCart,
  Tag,
  Users,
  FileText,
  Globe,
} from 'lucide-react';
import type { SummaryTabProps } from './types';
import { StatCard, DistributionBar, SummarySection, ListRow } from './StatCard';

export function OtpPtrSummary({
  tasks,
  columns,
  columnOrder,
  resolveMemberName,
}: SummaryTabProps) {
  const allTasks = Object.values(tasks);
  const totalItems = allTasks.length;

  // Revenue metrics
  let totalRevenue = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  for (const t of allTasks) {
    const price = Number(t.metadata?.price) || 0;
    totalRevenue += price;
    if (t.metadata?.isPaid) {
      paidCount++;
    } else {
      unpaidCount++;
    }
  }

  // Request type distribution (OTP / PTR / CUSTOM)
  const requestTypeMap: Record<string, number> = {};
  for (const t of allTasks) {
    const type = (t.metadata?.requestType as string) || 'Unknown';
    requestTypeMap[type] = (requestTypeMap[type] ?? 0) + 1;
  }

  // Content style distribution
  const contentStyleMap: Record<string, number> = {};
  for (const t of allTasks) {
    const style = (t.metadata?.contentStyle as string) || 'NORMAL';
    contentStyleMap[style] = (contentStyleMap[style] ?? 0) + 1;
  }
  const contentStyleEntries = Object.entries(contentStyleMap).sort((a, b) => b[1] - a[1]);

  // Top buyers
  const buyerMap: Record<string, number> = {};
  for (const t of allTasks) {
    const buyer = (t.metadata?.buyer as string);
    if (buyer) {
      buyerMap[buyer] = (buyerMap[buyer] ?? 0) + 1;
    }
  }
  const topBuyers = Object.entries(buyerMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Platform distribution
  const platformMap: Record<string, number> = {};
  for (const t of allTasks) {
    const platforms = (t.metadata?.platforms as string[]) ?? [];
    if (platforms.length === 0) {
      platformMap['Unset'] = (platformMap['Unset'] ?? 0) + 1;
    } else {
      for (const p of platforms) {
        platformMap[p] = (platformMap[p] ?? 0) + 1;
      }
    }
  }

  // Caption status distribution
  const captionStatusMap: Record<string, number> = {};
  for (const t of allTasks) {
    const status = (t.metadata?.otpPtrCaptionStatus as string) || 'none';
    captionStatusMap[status] = (captionStatusMap[status] ?? 0) + 1;
  }

  // Assignee workload
  const assigneeMap: Record<string, number> = {};
  for (const t of allTasks) {
    const name = resolveMemberName(t.assignee) ?? 'Unassigned';
    assigneeMap[name] = (assigneeMap[name] ?? 0) + 1;
  }
  const assigneeEntries = Object.entries(assigneeMap).sort((a, b) => b[1] - a[1]);

  // Fulfilled (last column)
  const lastColId = columnOrder[columnOrder.length - 1];
  const fulfilledCount = lastColId ? (columns[lastColId]?.taskIds.length ?? 0) : 0;

  // Column stats
  const columnStats = columnOrder
    .map((colId) => {
      const col = columns[colId];
      if (!col) return null;
      return { label: col.title, count: col.taskIds.length };
    })
    .filter(Boolean) as { label: string; count: number }[];

  const requestTypeColors: Record<string, string> = {
    OTP: 'bg-brand-light-pink',
    PTR: 'bg-brand-blue',
    CUSTOM: 'bg-violet-500',
    Unknown: 'bg-gray-500',
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1729]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      <div className="h-[3px] bg-gradient-to-r from-brand-dark-pink via-brand-light-pink to-brand-mid-pink/40" />

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            icon={<DollarSign className="w-3.5 h-3.5" />}
            accent="green"
          />
          <StatCard
            label="Total Items"
            value={totalItems}
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            accent="blue"
          />
          <StatCard
            label="Fulfilled"
            value={fulfilledCount}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            accent="pink"
            sub={totalItems > 0 ? `${Math.round((fulfilledCount / totalItems) * 100)}%` : undefined}
          />
          <StatCard
            label="Avg Price"
            value={totalItems > 0 ? `$${Math.round(totalRevenue / totalItems)}` : '$0'}
            icon={<ShoppingCart className="w-3.5 h-3.5" />}
            accent="violet"
          />
        </div>

        {/* Payment status */}
        <SummarySection title="Payment Status">
          <DistributionBar
            items={[
              { label: 'Paid', count: paidCount, color: 'bg-emerald-500' },
              { label: 'Unpaid', count: unpaidCount, color: 'bg-red-500' },
            ]}
            total={totalItems}
          />
        </SummarySection>

        {/* Request Type */}
        {Object.keys(requestTypeMap).length > 0 && (
          <SummarySection title="Request Type">
            <DistributionBar
              items={Object.entries(requestTypeMap).map(([type, count]) => ({
                label: type,
                count,
                color: requestTypeColors[type] ?? 'bg-gray-500',
              }))}
              total={totalItems}
            />
          </SummarySection>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Content Style */}
          {contentStyleEntries.length > 0 && (
            <SummarySection title="Content Style">
              <div className="space-y-1.5">
                {contentStyleEntries.map(([style, count]) => (
                  <ListRow
                    key={style}
                    label={style.replace(/_/g, ' ')}
                    value={count}
                  />
                ))}
              </div>
            </SummarySection>
          )}

          {/* Caption Status */}
          <SummarySection title="Caption Status">
            <div className="space-y-1.5">
              {Object.entries(captionStatusMap).map(([status, count]) => (
                <ListRow
                  key={status}
                  label={status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  value={count}
                  accent={
                    status === 'approved' ? 'text-emerald-400' :
                    status === 'rejected' ? 'text-red-400' :
                    status === 'submitted' ? 'text-brand-blue' :
                    undefined
                  }
                />
              ))}
            </div>
          </SummarySection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Buyers */}
          {topBuyers.length > 0 && (
            <SummarySection title="Top Buyers">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {topBuyers.map(([buyer, count]) => (
                  <ListRow key={buyer} label={`@${buyer}`} value={count} accent="text-brand-blue" />
                ))}
              </div>
            </SummarySection>
          )}

          {/* Assignee Workload */}
          <SummarySection title="Assignee Workload">
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {assigneeEntries.length === 0 ? (
                <p className="text-[12px] text-gray-500">No items yet</p>
              ) : (
                assigneeEntries.map(([name, count]) => (
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
