'use client';

import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: 'pink' | 'blue' | 'green' | 'amber' | 'violet' | 'default';
  sub?: string;
}

const accentMap: Record<string, string> = {
  pink: 'from-brand-light-pink/20 to-brand-dark-pink/10 border-brand-light-pink/20',
  blue: 'from-brand-blue/20 to-brand-blue/10 border-brand-blue/20',
  green: 'from-emerald-500/20 to-emerald-500/10 border-emerald-500/20',
  amber: 'from-amber-500/20 to-amber-500/10 border-amber-500/20',
  violet: 'from-violet-500/20 to-violet-500/10 border-violet-500/20',
  default: 'from-white/[0.04] to-white/[0.02] border-white/[0.08]',
};

const valueColorMap: Record<string, string> = {
  pink: 'text-brand-light-pink',
  blue: 'text-brand-blue',
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
  default: 'text-white',
};

export function StatCard({ label, value, icon, accent = 'default', sub }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-4 ${accentMap[accent]}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${valueColorMap[accent]}`}>{value}</p>
      {sub && (
        <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
      )}
    </div>
  );
}

interface DistributionBarProps {
  items: { label: string; count: number; color: string }[];
  total: number;
}

export function DistributionBar({ items, total }: DistributionBarProps) {
  if (total === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.06]">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.color} transition-all duration-300`}
            style={{ width: `${(item.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[11px] text-gray-400">
              {item.label}{' '}
              <span className="text-gray-500">({item.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SummarySectionProps {
  title: string;
  children: ReactNode;
}

export function SummarySection({ title, children }: SummarySectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em]">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface ListRowProps {
  label: string;
  value: string | number;
  accent?: string;
}

export function ListRow({ label, value, accent }: ListRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
      <span className="text-[12px] text-gray-400">{label}</span>
      <span className={`text-[13px] font-semibold ${accent ?? 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}
